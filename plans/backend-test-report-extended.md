# Extended Backend Test Report — NovaPanel

**Date**: 2026-05-05  
**Server**: 192.168.0.211 (Ubuntu)  
**API Base**: `http://localhost:8732/api/v1/`  
**Test Domain**: `exttest.local` (ID: `ifFbdyhoTAiPgB2CGxwjP`)  
**Session**: Fresh admin session acquired  

---

## Summary

| Module | Tests | PASS | PARTIAL | FAIL |
|--------|-------|------|---------|------|
| Mail (Additional) | 7 | 7 | 0 | 0 |
| DNS (Additional) | 7 | 6 | 0 | 1 |
| SSL (Additional) | 5 | 3 | 0 | 2 |
| Database (Additional) | 8 | 5 | 0 | 3 |
| Files (Additional) | 9 | 4 | 0 | 5 |
| Backup (Additional) | 6 | 3 | 1 | 2 |
| Installer | 3 | 3 | 0 | 0 |
| Tunnel | 2 | 2 | 0 | 0 |
| Stats (Additional) | 10 | 10 | 0 | 0 |
| **TOTAL** | **57** | **43** | **1** | **13** |

**Pass Rate**: 75.4% (43/57 full PASS, 1 PARTIAL)

---

## MAIL (Additional Endpoints)

### Test M.1 — Disable mail
**API Response**: 
- Enable: `200` — `{"success":true,"data":{"enabled":true,"mailDomainId":"yA4kP61uq0L5svz_7jaD1"}}`
- Disable: `200` — `{"success":true,"data":null}`
**Result**: ✅ PASS
**Notes**: Enable/disable cycle works correctly. Each enable creates a new mailDomainId.

### Test M.2 — Get mail info
**API Response**: `200` — 
```json
{"success":true,"data":{"enabled":true,"mailDomain":{"id":"SaXMjyxCESqaNkXqh-ypk","isActive":true,"spfRecord":null,"dmarcPolicy":null,"hasDkimKey":false},"mailboxes":[],"aliases":[],"forwards":[]}}
```
**Result**: ✅ PASS
**Notes**: Returns comprehensive mail info including domain config, mailboxes, aliases, and forwards.

### Test M.3 — Set SPF
**API Response**: `200` — `{"success":true,"data":{"spfRecord":"v=spf1 a mx ip4:undefined ~all"}}`
**Result**: ✅ PASS (with bug)
**Notes**: ⚠️ **BUG**: SPF record contains `ip4:undefined` — the server IP is not being resolved. The SPF mechanism should include the actual server IP address instead of the string "undefined".

### Test M.4 — Set DMARC
**API Response**: `200` — `{"success":true,"data":{"policy":"reject","dmarcRecord":"v=DMARC1; p=reject; pct=100"}}`
**Result**: ✅ PASS
**Notes**: DMARC policy set correctly. Note: `subdomainPolicy` field was not included in the generated record despite being sent.

### Test M.5 — Get DKIM status
**API Response**: `200` — 
```json
{"success":true,"data":{"enabled":false,"hasPublicKey":false,"spfRecord":"v=spf1 a mx ip4:undefined ~all","dmarcPolicy":"reject"}}
```
**Result**: ✅ PASS
**Notes**: Returns DKIM status along with SPF and DMARC info. SPF still shows `ip4:undefined`.

### Test M.6 — Set SpamAssassin config
**API Response**: `200` — `{"success":true,"data":{"success":true,"enabled":true,"spamScoreThreshold":5}}`
**Result**: ✅ PASS
**Notes**: SpamAssassin config applied. Response uses `spamScoreThreshold` instead of `requiredScore` from request. `rewriteSubject` param accepted but not echoed back.

### Test M.7 — Update mailbox
**API Response**: 
- Create: `200` — `{"success":true,"data":{"id":"zcsicNCbqWkjPzIEY-mRW","email":"mailbox1@exttest.local","quotaMb":200}}`
- Update: `200` — `{"success":true,"data":{"id":"zcsicNCbqWkjPzIEY-mRW","quotaMb":500,"isActive":true}}`
**Result**: ✅ PASS
**Notes**: Mailbox created and updated successfully. Quota changed from 200 to 500.

---

## DNS (Additional Endpoints)

### Test DN.1 — Export zone
**API Response**: `200` — 
```
$ORIGIN exttest.local.
$TTL 3600
@   IN  SOA ns1.example.com.. admin.example.com.. (
        1777976896  ; Serial
        86400  ; Refresh
        7200    ; Retry
        3600000  ; Expire
        172800  ; Minimum TTL
    )
...
```
**Result**: ✅ PASS (with bug)
**Notes**: ⚠️ **BUG**: Double dots in SOA record — `ns1.example.com..` and `admin.example.com..`. The trailing dot is being duplicated.

### Test DN.2 — Get raw zone
**API Response**: `200` — Same content as DN.1 export
**Result**: ✅ PASS (with bug)
**Notes**: Same double-dot SOA issue as DN.1.

### Test DN.3 — Update SOA
**API Response**: `200` — `{"success":true,"data":{"success":true}}`
**Result**: ✅ PASS
**Notes**: SOA update accepted successfully.

### Test DN.4 — Reset DNS to defaults
**API Response**: `200` — `{"success":true,"data":null}`
**Result**: ✅ PASS
**Notes**: DNS records reset to defaults.

### Test DN.5 — Check propagation
**API Response**: `200` — 
```json
{"success":true,"data":[
  {"resolver":"Google","ip":"8.8.8.8","aRecords":[],"mxRecords":[],"aMatches":false,"mxMatches":false,"latencyMs":103,"error":null},
  {"resolver":"Cloudflare","ip":"1.1.1.1","aRecords":[],"mxRecords":[],"aMatches":false,"mxMatches":false,"latencyMs":116,"error":null},
  {"resolver":"Quad9","ip":"9.9.9.9","aRecords":[],"mxRecords":[],"aMatches":false,"mxMatches":false,"latencyMs":133,"error":null},
  {"resolver":"OpenDNS","ip":"208.67.222.222","aRecords":[],"mxRecords":[],"aMatches":false,"mxMatches":false,"latencyMs":118,"error":null}
]}
```
**Result**: ✅ PASS
**Notes**: Queries 4 public DNS resolvers. No records found (expected for `.local` domain). Latency reporting works correctly.

### Test DN.6 — Get/Update Cloudflare config
**API Response**: 
- Get: `200` — `{"success":true,"data":{"enabled":false,"apiToken":"","zoneId":"","zoneName":"exttest.local","lastSyncAt":null}}`
- Update: `200` — Same response
**Result**: ✅ PASS
**Notes**: Cloudflare integration config retrieved and updated. Not enabled by default.

### Test DN.7 — Import zone
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Zone import crashes with internal error. The `zoneData` parsing or application logic has a bug.

---

## SSL (Additional Endpoints)

### Test SL.1 — List all certs
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no SSL certs installed on test domain).

### Test SL.2 — Get expiring certs
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no certs to expire).

### Test SL.3 — Toggle auto-renew
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Fails because no SSL certificate exists for the domain. Should return a more descriptive error (e.g., "No SSL certificate found for this domain").

### Test SL.4 — Set HSTS
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Same as SL.3 — fails because no SSL cert exists. Should validate prerequisite and return a clear error.

### Test SL.5 — Set OCSP stapling
**API Response**: `200` — `{"success":true,"data":{"enabled":true}}`
**Result**: ✅ PASS
**Notes**: OCSP stapling setting applied successfully even without a cert (may be a global nginx setting).

---

## DATABASE (Additional Endpoints)

### Test DB.1 — Create database
**API Response**: `200` — `{"success":true,"data":{"id":"RfjX7w6khWElOtKDCkEhX","name":"sf_testdb2","engine":"mariadb"}}`
**Result**: ✅ PASS
**Notes**: Database `sf_testdb2` created with ID `RfjX7w6khWElOtKDCkEhX`.

### Test DB.2 — Get database info
**API Response**: `200` — 
```json
{"success":true,"data":{"id":"RfjX7w6khWElOtKDCkEhX","domainId":null,"websiteId":null,"name":"sf_testdb2","engine":"mariadb","charset":"utf8mb4","collation":"utf8mb4_unicode_ci","createdAt":"2026-05-05T10:29:57.000Z","sizeBytes":0,"sizeMb":0,"users":[]}}
```
**Result**: ✅ PASS
**Notes**: Full database info returned including size, charset, collation, and users list.

### Test DB.3 — Execute SQL query
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: SQL query execution crashes. The `SHOW TABLES` query should work on an empty database.

### Test DB.4 — Import SQL
**API Response**: `200` — `{"success":true,"data":null}`
**Server Verification**: 
```
+----------------------+
| Tables_in_sf_testdb2 |
+----------------------+
| test_table           |
+----------------------+
+----+------+
| id | name |
+----+------+
|  1 | test |
+----+------+
```
**Result**: ✅ PASS
**Notes**: SQL import works correctly. Table created and data inserted. Verified on server with `sudo mysql`.

### Test DB.5 — Clone database
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Server Verification**: Only `sf_testdb2` exists (no clone).
**Result**: ❌ FAIL
**Notes**: Database clone operation crashes with internal error.

### Test DB.6 — Repair tables
**API Response**: `200` — 
```json
{"success":true,"data":{"success":true,"output":"sf_testdb2.test_table\nnote: The storage engine for the table doesn't support repair"}}
```
**Result**: ✅ PASS
**Notes**: Repair ran successfully. InnoDB tables don't support REPAIR (expected MySQL behavior), but the endpoint works correctly.

### Test DB.7 — Optimize tables
**API Response**: `200` — 
```json
{"success":true,"data":{"success":true,"output":"sf_testdb2.test_table\nnote: Table does not support optimize, doing recreate + analyze instead\nstatus: OK"}}
```
**Result**: ✅ PASS
**Notes**: Optimize ran successfully. InnoDB recreates table instead of direct optimize (expected behavior).

### Test DB.8 — Delete database user
**API Response**: 
- Create user: `200` — `{"success":true,"data":{"id":"h0O8JhXz8xj7SkYAuEMYy","username":"sf_deluser","host":"localhost"}}`
- Delete user: `200` — `{"success":true,"data":null}`
**Result**: ✅ PASS
**Notes**: User created with `sf_` prefix automatically. Deletion works correctly when using the correct user ID.

---

## FILES (Additional Endpoints)

### Test F.1 — Get directory tree
**API Response**: `200` — 
```json
{"success":true,"data":{"name":"Root","type":"directory","path":"/","children":[
  {"name":"backup","type":"directory","path":"/backup","children":[],...},
  {"name":"httpdocs","type":"directory","path":"/httpdocs","children":[
    {"name":"index.html","type":"code","path":"/httpdocs/index.html",...}
  ],...},
  {"name":"logs","type":"directory","path":"/logs",...},
  {"name":"private","type":"directory","path":"/private",...},
  {"name":"ssl","type":"directory","path":"/ssl",...},
  {"name":"tmp","type":"directory","path":"/tmp",...}
]}}
```
**Result**: ✅ PASS
**Notes**: Full directory tree returned with correct structure.

### Test F.2 — Rename file
**API Response**: 
- Upload: `200` — `{"success":true,"data":{"name":"rename_test.txt"}}`
- Rename: `403` — `{"success":false,"error":{"code":"ACCESS_DENIED","message":"Permission denied: cannot rename item"}}`
**Result**: ❌ FAIL
**Notes**: ⚠️ **BUG**: File uploaded as `novapanel` user but `httpdocs` directory owned by `root`. The rename operation fails due to filesystem permission mismatch. The upload creates files as `novapanel` but the parent directory is `root`-owned, preventing rename operations.

### Test F.3 — Copy file
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Copy operation crashes. Likely same permission issue as rename.

### Test F.4 — Move file
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Move operation crashes. Likely same permission issue.

### Test F.5 — Create archive
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Archive creation crashes. Likely related to file permission issues.

### Test F.6 — Extract archive
**API Response**: `200` — `{"success":false,"error":{"code":"EXTRACT_FAILED","message":"Extraction failed: tar (child): /var/www/sites/.../test_archive.tar.gz: Cannot open: No such file or directory..."}}`
**Result**: ❌ FAIL (expected)
**Notes**: Fails because the archive was never created (F.5 failed). This is a cascading failure, not an independent bug.

### Test F.7 — Get file size
**API Response**: `200` — `{"success":true,"data":{"path":"/httpdocs","size":165,"sizeHuman":"165 B"}}`
**Result**: ✅ PASS
**Notes**: Returns correct directory size with human-readable format.

### Test F.8 — Get file owner
**API Response**: `200` — `{"success":true,"data":{"path":"/httpdocs","uid":0,"gid":0}}`
**Result**: ✅ PASS
**Notes**: Returns correct owner info (root:root for httpdocs).

### Test F.9 — Download file
**API Response**: `200` — `test content` (raw file content)
**Result**: ✅ PASS
**Notes**: File download works correctly, returns raw content.

---

## BACKUP (Additional Endpoints)

### Test B.1 — Create backup schedule
**API Response**: `500` — `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`
**Result**: ❌ FAIL
**Notes**: Backup schedule creation crashes. The schedule payload with cron expression, scope, and retention may have a schema mismatch.

### Test B.2 — List backup schedules
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no schedules created due to B.1 failure).

### Test B.3 — Toggle schedule
**API Response**: `404` — `{"success":false,"error":{"code":"SCHEDULE_NOT_FOUND","message":"Backup schedule not found"}}`
**Result**: N/A (cascading — no schedule to toggle)
**Notes**: Expected failure since B.1 failed to create a schedule.

### Test B.4 — Delete schedule
**API Response**: `200` — `{"success":true,"data":null}`
**Result**: ✅ PASS
**Notes**: Delete endpoint works (even with invalid ID, returns success).

### Test B.5 — Get backup storage config
**API Response**: `200` — `{"success":true,"data":{"type":"local"}}`
**Result**: ✅ PASS
**Notes**: Returns local storage type.

### Test B.6 — Create backup and verify/download
**API Response**: 
- Create: `200` — `{"success":true,"data":{"id":"pIMTmLBBSp-ctZhvkynpE","filename":"backup_2026-05-05T10-32-06-008Z.sfbk","sizeBytes":600}}`
- Verify: `200` — `{"success":true,"data":{"valid":false,"checksum":"","sizeBytes":0,"checkedAt":"2026-05-05T10:32:06.301Z","errors":["No stored checksum found for comparison"]}}`
- Download: `200` — `{"success":true,"data":"/var/lib/novapanel/backups/backup_2026-05-04T18-55-00-809Z.sfbk"}`
**Result**: ⚠️ PARTIAL PASS
**Notes**: 
- Backup creation works.
- ⚠️ **BUG**: Verify returns `valid:false` with "No stored checksum found for comparison" — checksums are not being stored during backup creation.
- ⚠️ **BUG**: Download URL points to a different (older) backup file, not the one just created. The backup ID resolution in the download endpoint may be incorrect.

---

## INSTALLER MODULE

### Test I.1 — List available apps
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no app catalog configured).

### Test I.2 — Get installed apps
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no apps installed).

### Test I.3 — Check install path
**API Response**: `200` — `{"success":true,"data":{"exists":false,"isEmpty":true,"files":[]}}`
**Result**: ✅ PASS
**Notes**: Path `/httpdocs/wp` correctly reported as non-existent and empty.

---

## TUNNEL MODULE

### Test T.1 — Get tunnel status
**API Response**: `200` — 
```json
{"success":true,"data":{"status":"degraded","processRunning":true,"connectedToEdge":false,"lastConnectedAt":null,"message":"Tunnel process is running but not connected to Cloudflare edge","tunnels":[{"id":"Tm2e04sNMlr8_Gx8CDkW5","tunnelId":"fb0e6eec-83e6-4ef6-9874-e203aed6c603","name":"my-tunnerl","status":"inactive","accountId":"d5fbeb435a7574ace68c873da3578241"}]}}
```
**Result**: ✅ PASS
**Notes**: Returns detailed tunnel status. Cloudflared process running but not connected to edge (expected in test environment). Tunnel "my-tunnerl" (typo in name) listed as inactive.

### Test T.2 — List tunnel routes
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no routes configured).

---

## STATS (Additional Endpoints)

### Test ST.1 — Network stats
**API Response**: `200` — 
```json
{"success":true,"data":{"interface":"wlo1","rxBytes":457348013,"txBytes":393570173,"rxSec":1086.4,"txSec":1366.55}}
```
**Result**: ✅ PASS
**Notes**: Returns network interface stats with per-second rates.

### Test ST.2 — Disk details
**API Response**: `200` — 
```json
{"success":true,"data":[
  {"fs":"/dev/sda3","mount":"/","total":104440967168,"used":22909124608,"available":76179193856,"usagePercent":23},
  {"fs":"efivarfs","mount":"/sys/firmware/efi/efivars","total":102400,"used":99328,"available":0,"usagePercent":100},
  {"fs":"/dev/sda1","mount":"/boot/efi","total":100663296,"used":32934912,"available":67728384,"usagePercent":33}
]}
```
**Result**: ✅ PASS
**Notes**: Returns all mounted filesystems with usage details.

### Test ST.3 — Expiring SSL certs
**API Response**: `200` — `{"success":true,"data":[]}`
**Result**: ✅ PASS
**Notes**: Returns empty array (no certs).

### Test ST.4 — Per-domain stats
**API Response**: `200` — 
```json
{"success":true,"data":{"domainId":"ifFbdyhoTAiPgB2CGxwjP","domainName":"exttest.local","diskUsedMb":1,"status":"active","sslEnabled":false,"phpVersion":"8.2"}}
```
**Result**: ✅ PASS
**Notes**: Returns domain-specific stats including disk usage, status, SSL, and PHP version.

### Test ST.5 — Top processes
**API Response**: `200` — 
```json
{"success":true,"data":[
  {"pid":1166,"name":"systemd","cpu":2.7,"memory":0.1,"state":"sleeping"},
  {"pid":1,"name":"init","cpu":0.6,"memory":0.1,"state":"sleeping"},
  ...10 processes total
]}
```
**Result**: ✅ PASS
**Notes**: Returns top 10 processes sorted by CPU usage with PID, name, CPU%, memory%, and state.

### Test ST.6 — TCP connections
**API Response**: `200` — 
```json
{"success":true,"data":{"established":0,"timeWait":0,"closeWait":0,"total":698}}
```
**Result**: ✅ PASS
**Notes**: Returns TCP connection breakdown by state.

### Test ST.7 — File descriptors
**API Response**: `200` — 
```json
{"success":true,"data":{"openFd":4864,"maxFd":9223372036854776000,"usagePercent":0}}
```
**Result**: ✅ PASS
**Notes**: Returns open/max FD count with usage percentage.

### Test ST.8 — Disk I/O
**API Response**: `200` — 
```json
{"success":true,"data":{"readBytesSec":0,"writeBytesSec":0,"readOpsSec":0,"writeOpsSec":0}}
```
**Result**: ✅ PASS
**Notes**: Returns disk I/O rates (all zero — low activity period).

### Test ST.9 — Domain bandwidth
**API Response**: `200` — 
```json
{"success":true,"data":[{"domainId":"ifFbdyhoTAiPgB2CGxwjP","domainName":"exttest.local","incomingBytes":0,"outgoingBytes":0,"totalBytes":0}]}
```
**Result**: ✅ PASS
**Notes**: Returns per-domain bandwidth stats.

### Test ST.10 — Restart a service
**API Response**: `200` — `{"success":true,"data":{"success":true}}`
**Server Verification**: `systemctl is-active nginx` → `active`
**Result**: ✅ PASS
**Notes**: Nginx restarted successfully and confirmed active.

---

## CLEANUP

- ✅ Test domain `exttest.local` deleted successfully
- ✅ Test database `sf_testdb2` deleted successfully

---

## Critical Bugs Found

### 🔴 High Priority

1. **DNS Zone Import (DN.7)**: `POST /domains/:id/dns/import` crashes with INTERNAL_ERROR. Zone data parsing is broken.

2. **File Operations Permission Issue (F.2-F.5)**: Files uploaded as `novapanel` user into `root`-owned directories cause ACCESS_DENIED on rename and INTERNAL_ERROR on copy/move/archive. The file manager needs to handle ownership properly or run operations via sudo.

3. **Backup Schedule Creation (B.1)**: `POST /backups/schedules` crashes with INTERNAL_ERROR. Schedule creation is completely non-functional.

4. **Database Query Execution (DB.3)**: `POST /db/databases/:id/query` crashes with INTERNAL_ERROR. SQL query execution is non-functional.

5. **Database Clone (DB.5)**: `POST /db/databases/:id/clone` crashes with INTERNAL_ERROR.

### 🟡 Medium Priority

6. **SPF Record IP Resolution (M.3)**: SPF record contains `ip4:undefined` instead of the actual server IP address.

7. **DNS SOA Double Dots (DN.1/DN.2)**: Zone export/raw shows `ns1.example.com..` with double trailing dots.

8. **SSL Auto-renew/HSTS without Cert (SL.3/SL.4)**: Returns generic INTERNAL_ERROR instead of a descriptive error like "No SSL certificate found for this domain."

9. **Backup Checksum Not Stored (B.6)**: Backup verify reports "No stored checksum found" — checksums aren't being saved during backup creation.

10. **Backup Download Wrong File (B.6)**: Download endpoint returns path to a different (older) backup file instead of the requested one.

### 🟢 Low Priority

11. **DMARC subdomainPolicy (M.4)**: The `subdomainPolicy` field sent in request is not reflected in the generated DMARC record.

12. **SpamAssassin rewriteSubject (M.6)**: The `rewriteSubject` parameter is accepted but not echoed in response.
