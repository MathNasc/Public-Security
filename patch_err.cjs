const fs = require('fs');

const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'logger.error("SSP upload processing error", { event: "ssp_upload_error", error: error.message });',
  'logger.error("SSP upload processing error", { event: "ssp_upload_error", error: error.message, cause: error.cause ? error.cause.message : null });'
);

code = code.replace(
  'res.status(500).json({ error: "Failed to queue SSP file", details: error.message });',
  'res.status(500).json({ error: "Failed to queue SSP file", details: error.message, cause: error.cause ? error.cause.message : null });'
);

fs.writeFileSync(path, code);
