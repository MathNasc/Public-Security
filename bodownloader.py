from __future__ import unicode_literals
from xlwt import Workbook
from bs4 import BeautifulSoup
import requests
import time
import datetime
import io
import os
import pandas as pd
import csv
from func_timeout import func_set_timeout
# ----------------------------------------------------------------------------------------------------------------------
# Variáveis Globais
# ----------------------------------------------------------------------------------------------------------------------
duration_limit = 120
request_limit = 10
sleep_seconds = 1
num_requests = 0
all_target = False
response = None
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:69.0) Gecko/20100101 Firefox/69.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Connection': 'keep-alive',
    'Referer': 'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx',
    'Upgrade-Insecure-Requests': '1',
}
event_validation = ""
view_state = ""
view_state_generator = ""
department_filter = "0"
cookies = {}
btn_event_target = ''
lk_year_event_target = 'ctl00$cphBody$lkAno'
lk_month_event_target = 'ctl00$cphBody$lkMes'
export_event_target = 'ctl00$cphBody$ExportarBOLink'
year_target = ""
month_target = ""
file_target = ""
month_path = ""
xls_path = ""
csv_path = ""
target_list = ['Feminicidio', 'MortePolicial', 'RouboVeiculo']
month_list = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
              'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
# ----------------------------------------------------------------------------------------------------------------------
# Obter os milisegundos do hdf_file:
# ----------------------------------------------------------------------------------------------------------------------
def now_milliseconds():
   return int(time.time() * 1000)
# ----------------------------------------------------------------------------------------------------------------------
# Saber se o usuário deseja personalizar sua resquisição ou usar o default.
# ----------------------------------------------------------------------------------------------------------------------
def is_default():
    while True:
        print("========================================")
        print("=          BOLETIM DOWNLOADER          =")
        print("========================================")
        input_value = input('   1 - Requisição personalizada\n'
                            '   2 - Requisição padrão\n'
                            '\nEscolha a opção: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                default = False
                break
            elif option == 2:
                default = True
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")

    return default
# ----------------------------------------------------------------------------------------------------------------------
# Obter o tipo de BO desejado.
# ----------------------------------------------------------------------------------------------------------------------
def get_target():
    global btn_event_target
    global file_target
    global all_target
    while True:
        print("----------------------------------------")
        print("-                Boletim               -")
        print("----------------------------------------")
        input_value = input('   1 - Feminicídio\n'
                            '   2 - Morte decorrente de ação policial\n'
                            '   3 - Roubo de veículo\n'
                            '   4 - Todos\n'
                            '\nEscolha o boletim que deseja baixar: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                file_target = "Feminicidio"
                btn_event_target = "ctl00$cphBody$btn" + file_target
                break
            elif option == 2:
                file_target = "MortePolicial"
                btn_event_target = "ctl00$cphBody$btn" + file_target
                break
            elif option == 3:
                file_target = "RouboVeiculo"
                btn_event_target = "ctl00$cphBody$btn" + file_target
                break
            elif option == 4:
                all_target = True
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")
# ----------------------------------------------------------------------------------------------------------------------
# Obter o Ano para o BO desejado
# ----------------------------------------------------------------------------------------------------------------------
def get_target_year():
    global lk_year_event_target
    global year_target
    while True:
        print("----------------------------------------")
        print("-                  Ano                 -")
        print("----------------------------------------")
        input_value = input('   1 - 2019\n'
                            '   2 - 2018\n'
                            '   3 - 2017\n'
                            '   4 - 2016\n'
                            '   5 - 2015\n'
                            '\nEscolha o ano que deseja baixar: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                year_target = "19"
                lk_year_event_target += year_target
                break
            elif option == 2:
                year_target = "18"
                lk_year_event_target += year_target
                break
            elif option == 3:
                year_target = "17"
                lk_year_event_target += year_target
                break
            elif option == 4:
                year_target = "16"
                lk_year_event_target += year_target
                break
            elif option == 5:
                year_target = "15"
                lk_year_event_target += year_target
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")
# ----------------------------------------------------------------------------------------------------------------------
# Obter o Mês para o BO desejado
# ----------------------------------------------------------------------------------------------------------------------
def get_target_month():
    global lk_month_event_target
    global month_target
    while True:
        print("------------------------------------------------")
        print("-                      Mês                     -")
        print("------------------------------------------------")
        input_value = input('| 1 - Janeiro  | 2 - Fevereiro | 3 - Março     |\n'
                            '| 4 - Abril    | 5 - Maio      | 6 - Junho     |\n'
                            '| 7 - Julho    | 8 - Agosto    | 9 - Setembro  |\n'
                            '| 10 - Outubro | 11 - Novembro | 12 - Dezembro |\n'
                            '\nEscolha o mês que deseja baixar: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                month_target = "1"
                lk_month_event_target += month_target
                break
            elif option == 2:
                month_target = "2"
                lk_month_event_target += month_target
                break
            elif option == 3:
                month_target = "3"
                lk_month_event_target += month_target
                break
            elif option == 4:
                month_target = "4"
                lk_month_event_target += month_target
                break
            elif option == 5:
                month_target = "5"
                lk_month_event_target += month_target
                break
            elif option == 6:
                month_target = "6"
                lk_month_event_target += month_target
                break
            elif option == 7:
                month_target = "7"
                lk_month_event_target += month_target
                break
            elif option == 8:
                month_target = "8"
                lk_month_event_target += month_target
                break
            elif option == 9:
                month_target = "9"
                lk_month_event_target += month_target
                break
            elif option == 10:
                month_target = "10"
                lk_month_event_target += month_target
                break
            elif option == 11:
                month_target = "11"
                lk_month_event_target += month_target
                break
            elif option == 12:
                month_target = "12"
                lk_month_event_target += month_target
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")
# ----------------------------------------------------------------------------------------------------------------------
# Obter o tempo de espera nas requisições
# ----------------------------------------------------------------------------------------------------------------------
def get_sleep_seconds():
    global sleep_seconds
    while True:
        print("----------------------------------------")
        print("-            Tempo de espera           -")
        print("----------------------------------------")
        input_value = input('   1 - Extremamente Rápido (1 segundo)\n'
                            '   2 - Rápido (3 segundos)\n'
                            '   3 - Médio (6 segundos)\n'
                            '   4 - Lento (12 segundos)\n'
                            '   5 - Muito Lento (16 segundos)\n'
                            '   \n  OBS: Quanto menor o tempo de espera, maior a chanche de obter falha nas requisições.\n'
                            '\nEscolha o tempo de espera entre as requisições: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                sleep_seconds = 1
                break
            elif option == 2:
                sleep_seconds = 3
                break
            elif option == 3:
                sleep_seconds = 6
                break
            elif option == 4:
                sleep_seconds = 12
                break
            elif option == 5:
                sleep_seconds = 24
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")
# ----------------------------------------------------------------------------------------------------------------------
# Obter o número de tentativas para as requisições
# ----------------------------------------------------------------------------------------------------------------------
def get_request_limit():
    global request_limit
    while True:
        print("----------------------------------------")
        print("-              Tentativas              -")
        print("----------------------------------------")
        input_value = input('   1 - Uma tentativa\n'
                            '   2 - Cinco tentativas \n'
                            '   3 - Dez tentativas \n'
                            '   4 - Quinze tentativas \n'
                            '   5 - Vinte tentativas \n'
                            '   \n  OBS: Quanto maior o número de tentativas, maior chance de sucesso em requisições.\n'
                            '\nEscolha o limite de tentativas: ')
        if input_value.isdigit():
            option = int(input_value)
            if option == 1:
                request_limit = 1
                break
            elif option == 2:
                request_limit = 5
                break
            elif option == 3:
                request_limit = 10
                break
            elif option == 4:
                request_limit = 15
                break
            elif option == 5:
                request_limit = 20
                break
            else:
                print(">> INFO: Opção inválida.")
        else:
            print(">> INFO: Opção inválida.")
# ----------------------------------------------------------------------------------------------------------------------
# Scraping
# ----------------------------------------------------------------------------------------------------------------------
def scraping():
    global event_validation
    global view_state
    global view_state_generator
    global cookies
    soup = BeautifulSoup(response.content, 'html.parser')
    event_validation = soup.find(id='__EVENTVALIDATION').get('value')
    view_state = soup.find(id='__VIEWSTATE').get('value')
    view_state_generator = soup.find(id='__VIEWSTATEGENERATOR').get('value')
    cookies = dict(response.cookies)
# ----------------------------------------------------------------------------------------------------------------------
# Contador de requisições
# ----------------------------------------------------------------------------------------------------------------------
def request_counter():
    global num_requests
    num_requests += 1
# ----------------------------------------------------------------------------------------------------------------------
# Checar se a requisição foi bem sucedida
# ----------------------------------------------------------------------------------------------------------------------
def request_is_successful():
    global num_requests
    if response.status_code == 200:
        print('<< SUCCESS: {}ª Requisição bem sucedida!'.format(num_requests))
        return True
    else:
        num_requests = 0
        # response.raise_for_status()
        print('<< WARNING: Requisição mal sucedida. Tentando realizar novamente ...')
        return False
# ----------------------------------------------------------------------------------------------------------------------
# Verificar diretório onde será salvo o arquivo
# ----------------------------------------------------------------------------------------------------------------------
def check_directory(default):
    global xls_path
    global csv_path

    path = "boletins_de_ocorrencia/"+ file_target
    if not os.path.exists(path):
        os.makedirs(path)

    if default:
        year_path = datetime.date.today().year
        month_path = month_list[(datetime.date.today().month - 3)]
        xls_path = path + "/xls/" + str(year_path) + "/" + month_path
        csv_path = path + "/csv/" + str(year_path) + "/" + month_path
    else:
        month_path = month_list[(int(month_target)-1)]
        xls_path = path + "/xls/20" + year_target + "/" + month_path
        csv_path = path + "/csv/20" + year_target + "/" + month_path

    if not os.path.exists(xls_path):
        os.makedirs(xls_path)

    if not os.path.exists(csv_path):
        os.makedirs(csv_path)
# ----------------------------------------------------------------------------------------------------------------------
# Salvar em XLS E CSV
# ----------------------------------------------------------------------------------------------------------------------
def save():
    current_date = time.strftime("%Y_%m_%d-%H_%M_%S")
    xls_file_path = xls_path + "/" + file_target + "-" + current_date + ".xls"
    with open(xls_file_path, 'wb') as xls_file:
        for fragment in response.iter_content(chunk_size=256):
            xls_file.write(fragment)
    print(">> INFO: Download finalizado!")
    file1 = io.open(xls_file_path, "r", encoding="cp1252")
    data = file1.readlines()
    xldoc = Workbook()
    sheet = xldoc.add_sheet("Sheet1", cell_overwrite_ok=True)
    for i, row in enumerate(data):
        for j, val in enumerate(row.replace('\n', '').split('\t')):
            sheet.write(i, j, val)
    xldoc.save(xls_file_path)
    print(">> INFO: Arquivo XLS salvo em: {}".format(xls_file_path))
    df = pd.ExcelFile(xls_file_path).parse('Sheet1')
    current_date = time.strftime("%Y_%m_%d-%H_%M_%S")
    csv_file_path = csv_path + "/" + file_target + "-" + current_date + ".csv"
    df.to_csv(csv_file_path, sep=";", index=False, quoting=csv.QUOTE_NONE, escapechar=' ', encoding="cp1252")
    print(">> INFO: Arquivo CSV salvo em: {}".format(csv_file_path))
# ----------------------------------------------------------------------------------------------------------------------
# Requisição para obter o ano
# ----------------------------------------------------------------------------------------------------------------------
@func_set_timeout(duration_limit)
def year_request():
    global response
    data = {
        '__EVENTTARGET': lk_year_event_target,
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        '__VIEWSTATE': view_state,
        '__VIEWSTATEGENERATOR': view_state_generator,
        '__EVENTVALIDATION': event_validation,
        'ctl00$cphBody$hdfExport': ''
    }
    response = requests.post(
        'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx', headers=headers, data=data)
    request_counter()
    if request_is_successful():
        scraping()
        return True
    else:
        return False
# ----------------------------------------------------------------------------------------------------------------------
# Requisição para obter o mês
# ----------------------------------------------------------------------------------------------------------------------
@func_set_timeout(duration_limit)
def month_request():
    global response
    data = {
        '__EVENTTARGET': lk_month_event_target,
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        '__VIEWSTATE': view_state,
        '__VIEWSTATEGENERATOR': view_state_generator,
        '__EVENTVALIDATION': event_validation,
        'ctl00$cphBody$hdfExport': ''
    }
    response = requests.post(
        'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx', headers=headers, data=data)
    request_counter()
    if request_is_successful():
        scraping()
        return True
    else:
        return False
# ----------------------------------------------------------------------------------------------------------------------
# Requisição para obter a planiha:
# ----------------------------------------------------------------------------------------------------------------------
@func_set_timeout(240)
def stream_request():
    global response
    data = {
        '__EVENTTARGET': export_event_target,
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        '__VIEWSTATE': view_state,
        '__VIEWSTATEGENERATOR': view_state_generator,
        '__EVENTVALIDATION': event_validation,
        'ctl00$cphBody$filtroDepartamento': department_filter,
        'ctl00$cphBody$hdfExport': str(now_milliseconds())
    }
    response = requests.post('http://www.ssp.sp.gov.br/transparenciassp/', headers=headers, cookies=cookies,
                             data=data, verify=False, stream=True)
# ----------------------------------------------------------------------------------------------------------------------
# Requisição inicial
# ----------------------------------------------------------------------------------------------------------------------
@func_set_timeout(duration_limit)
def initial_request():
    global response
    response = requests.get(
        'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx', headers=headers)
    request_counter()
    error_counter = 0
    if response.status_code != 200:
        while response.status_code != 200:
            #response.raise_for_status()
            print('<< WARNING: Requisição mal sucedida. Tentando realizar novamente ...')
            time.sleep(sleep_seconds)
            response = requests.get(
                'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx', headers=headers)
            request_counter()
            error_counter += 1
            if error_counter == request_limit:
                print(">> INFO: Limite de requisições excedido, programa sendo finalizado.")
                break
    if error_counter == request_limit:
        return False
    else:
        scraping()
        print('<< SUCCESS: {}ª Requisição bem sucedida!'.format(num_requests))
        return True
# ----------------------------------------------------------------------------------------------------------------------
# Requisição intermediária
# ----------------------------------------------------------------------------------------------------------------------
@func_set_timeout(duration_limit)
def intermediate_request():
    global response
    data = {
        '__EVENTTARGET': btn_event_target,
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        '__VIEWSTATE': view_state,
        '__VIEWSTATEGENERATOR': view_state_generator,
        '__EVENTVALIDATION': event_validation,
        'ctl00$cphBody$hdfExport': ''
    }
    response = requests.post(
        'http://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx', headers=headers, data=data)
    request_counter()
    if request_is_successful():
        scraping()
        return True
    else:
        return False
# ----------------------------------------------------------------------------------------------------------------------
# Requisição final
# ----------------------------------------------------------------------------------------------------------------------
def final_request(default):
    global response
    if initial_request():
        time.sleep(sleep_seconds)
        if intermediate_request():
            time.sleep(sleep_seconds)
            # ----------------------------------------------------------------------------------------------------------
            # Se for requisição default
            # ----------------------------------------------------------------------------------------------------------
            if default:
                stream_request()
                request_counter()
                if request_is_successful():
                    return True
                else:
                    return False
            # ----------------------------------------------------------------------------------------------------------
            # Se for requisição personalizada
            # ---------------------------------------------------------------------------------------------------------
            else:
                if year_request():
                    time.sleep(sleep_seconds)
                    if month_request():
                        time.sleep(sleep_seconds)
                        stream_request()
                        request_counter()
                        if request_is_successful():
                            return True
                        else:
                            return False
                    else: # MONTH_REQUEST
                        return False
                else: # YEAR_REQUEST
                    return False
        else: # INTERMEDIATE_REQUEST
            return False
    else: # INITIAL_REQUEST
        return False
# ----------------------------------------------------------------------------------------------------------------------
# 0º passo: Verificar se irá ultilizar a requisição default
# ----------------------------------------------------------------------------------------------------------------------
if is_default():
    default = True
    for i in range(3):
        if i == 0:
            file_target = "Feminicidio"
            btn_event_target = "ctl00$cphBody$btn" + file_target
        elif i == 1:
            file_target = "MortePolicial"
            btn_event_target = "ctl00$cphBody$btn" + file_target
        else:
            file_target = "RouboVeiculo"
            btn_event_target = "ctl00$cphBody$btn" + file_target
        error_counter = 0
        while True:
            if final_request(default):
                print(">> INFO: Iniciando o download do arquivo...")
                check_directory(default)
                save()
                break
            else:
                error_counter += 1
                if error_counter == request_limit:
                    print(">> INFO: Limite de requisições excedido, programa sendo finalizado.")
                    break
else:
    default = False
    # ------------------------------------------------------------------------------------------------------------------
    # 1º passo: Obter a categoria do BO.
    # ------------------------------------------------------------------------------------------------------------------
    get_target()
    # ------------------------------------------------------------------------------------------------------------------
    # 2º passo: Obter o ano do BO.
    # ------------------------------------------------------------------------------------------------------------------
    get_target_year()
    # ------------------------------------------------------------------------------------------------------------------
    # 3º passo: Obter o mês do BO.
    # ------------------------------------------------------------------------------------------------------------------
    get_target_month()
    # ------------------------------------------------------------------------------------------------------------------
    # 4º passo: Obter os segundos de espera entre as requisições.
    # ------------------------------------------------------------------------------------------------------------------
    get_sleep_seconds()
    # ------------------------------------------------------------------------------------------------------------------
    # 5º passo: Obter o número de tentativas para cada requisição.
    # ------------------------------------------------------------------------------------------------------------------
    get_request_limit()
    # ------------------------------------------------------------------------------------------------------------------
    # 6º passo: Realizar requisições sequenciais para obter os valores necessários para download do BO.
    # Primeira requisição - Obter valor de __VIEWSTATE e __EVENTVALIDATION.
    # Segunda requisição - Obter o cookie.
    # Terceira requisição - Realizar o download do arquivo.
    # ------------------------------------------------------------------------------------------------------------------
    if all_target:
        for target in target_list:
            file_target = target
            btn_event_target = "ctl00$cphBody$btn" + file_target
            error_counter = 0
            while True:
                if final_request(default):
                    print(">> INFO: Iniciando o download do arquivo...")
            # ----------------------------------------------------------------------------------------------------------
            # 7º passo: Salvar arquivo em XLS e CSV na máquina
            # ----------------------------------------------------------------------------------------------------------
                    check_directory(default)
                    save()
                    time.sleep(5)
                    break
                else:
                    error_counter += 1
                    if error_counter == request_limit:
                        print(">> INFO: Limite de requisições excedido, programa sendo finalizado.")
                        time.sleep(5)
                        break
            if error_counter == request_limit:
                break
    else:
        error_counter = 0
        while True:
            if final_request(default):
                print(">> INFO: Iniciando o download do arquivo...")
                # ------------------------------------------------------------------------------------------------------
                # 7º passo: Salvar arquivo em XLS e CSV na máquina
                # ------------------------------------------------------------------------------------------------------
                check_directory(default)
                save()
                time.sleep(5)
                break
            else:
                error_counter += 1
                if error_counter == request_limit:
                    print(">> INFO: Limite de requisições excedido, programa sendo finalizado.")
                    time.sleep(5)
                    break
input('\nPressione qualquer tecla para finalizar...')
