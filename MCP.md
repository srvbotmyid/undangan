# MCP di server undangan

Setelah push dan Coolify selesai deploy, agent mengakses aplikasi ini lewat https://domain-kamu/mcp.

Cakupannya folder aplikasi di dalam container: kode, database, upload, dan perintah. Tidak keluar ke mesin di luar container.

## Aktifkan

Di Environment Variables Coolify tambah MCP_TOKEN berisi token acak panjang.

Redeploy. Log harus ada: MCP aktif di /mcp.

## Sambungkan agent

URL: https://domain-kamu/mcp

Header: Authorization: Bearer token-acak-panjang

Di Cursor: Settings, MCP, remote server. Isi URL dan header itu.

Tool: list_files, read_file, write_file, replace_in_file, run.

Perubahan file public langsung terbaca. Perubahan server.js butuh restart container.

Jangan commit nilai MCP_TOKEN.
