import sys
import os
import json
import sqlite3
import zipfile
import xml.etree.ElementTree as ET
import datetime
import uuid

def parse_sinesp(raw_file_path, dataset_id, db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    batch = []
    total_inserted = 0

    with zipfile.ZipFile(raw_file_path) as z:
        sheet_files = [n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')]
        sheet_file = sheet_files[0] if sheet_files else 'xl/worksheets/sheet1.xml'
        
        with z.open(sheet_file) as f:
            for event, elem in ET.iterparse(f, events=('end',)):
                if elem.tag.endswith('row'):
                    row_dict = {}
                    for c in elem:
                        r = c.attrib.get('r', '')
                        col = ''.join([ch for ch in r if not ch.isdigit()])
                        t = c.attrib.get('t', '')
                        val = None
                        if t == 'inlineStr':
                            is_elem = c.find('{*}is/{*}t')
                            if is_elem is not None: val = is_elem.text
                        else:
                            v_elem = c.find('{*}v')
                            if v_elem is not None: val = v_elem.text
                        row_dict[col] = val
                    
                    try:
                        tot = int(float(row_dict.get('K') or 0))
                    except:
                        tot = 0
                    
                    if tot > 0 and row_dict.get('A'):
                        uf = row_dict.get('A', '')[:2].upper()
                        crime = row_dict.get('C', '')
                        serial_dt = int(float(row_dict.get('D') or 0))
                        dt = datetime.date(1899, 12, 30) + datetime.timedelta(days=serial_dt)
                        period = dt.strftime('%Y-%m')
                        
                        cat = 'cvli' if any(w in crime.lower() for w in ['homic', 'latroc', 'morte', 'feminic']) else ('cvp' if any(w in crime.lower() for w in ['roubo', 'furto']) else 'other')
                        
                        batch.append((
                            str(uuid.uuid4()),
                            'SINESP',
                            dataset_id,
                            uf,
                            None,
                            cat,
                            crime,
                            crime,
                            period,
                            float(tot),
                            'occurrences',
                            'state'
                        ))
                        
                        if len(batch) >= 1000:
                            cur.executemany('''
                                INSERT OR IGNORE INTO security_indicators 
                                (id, source_id, dataset_id, state_code, municipality_code, category, subcategory, source_category, period, value, unit, granularity)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', batch)
                            total_inserted += len(batch)
                            batch = []
                    elem.clear()

    if batch:
        cur.executemany('''
            INSERT OR IGNORE INTO security_indicators 
            (id, source_id, dataset_id, state_code, municipality_code, category, subcategory, source_category, period, value, unit, granularity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
        total_inserted += len(batch)

    conn.commit()
    conn.close()
    return total_inserted

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
        
    raw_path = sys.argv[1]
    ds_id = sys.argv[2]
    db_p = sys.argv[3]
    
    try:
        count = parse_sinesp(raw_path, ds_id, db_p)
        print(json.dumps({"success": True, "recordsProcessed": count}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
