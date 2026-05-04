import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Box,
  Typography, FormControlLabel, Switch, Stack, Chip, Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon, Download as DownloadIcon,
  CheckCircle as OkIcon, ErrorOutline as ErrIcon,
} from '@mui/icons-material';
import { bulkUploadUsersApi } from '../../api/userApi';

/**
 * Bulk-upload dialog. Accepts a CSV with this header row:
 *
 *   username,firstName,lastName,initials,joiningDate,phone,email,
 *   designation,departmentCode,isDeptReviewer,isQaReviewer,password
 *
 * - Email is optional; everything else is required.
 * - departmentCode is mapped to departmentId at parse time.
 * - If autoGeneratePasswords is ON the password column may be left blank.
 */
const SAMPLE = [
  'username,firstName,lastName,initials,joiningDate,phone,email,designation,departmentCode,isDeptReviewer,isQaReviewer,password',
  'jdoe,John,Doe,JKD,2024-04-15,+91-9876543210,john.doe@acme.com,QA Officer,QA,false,true,Welcome@123',
  'rkumar,Ravi,,RKM,2024-06-01,+91-9123456780,,Production Engineer,PROD,false,false,',
].join('\n');

// ── CSV parser (simple — no quoted commas in field values; pharma HR exports rarely use them) ──
const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map((ln, idx) => {
    const cols = ln.split(',').map(c => c.trim());
    const row = {};
    header.forEach((h, i) => row[h] = cols[i] ?? '');
    row.__rowIndex = idx;
    return row;
  });
};

const toBool = (v) => /^(true|yes|y|1)$/i.test(String(v || '').trim());

const BulkUserUploadDialog = ({ open, onClose, departments = [], defaultRoleId, onUploaded }) => {
  const fileRef = useRef();
  const [parsed, setParsed]     = useState([]);
  const [parseError, setParseErr] = useState(null);
  const [autoGen, setAutoGen]   = useState(true);
  const [uploading, setUp]      = useState(false);
  const [result, setResult]     = useState(null);
  const [uploadErr, setUploadErr] = useState(null);

  const reset = () => {
    setParsed([]); setParseErr(null); setResult(null);
    setUploadErr(null); setUp(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseErr(null); setResult(null); setUploadErr(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setParsed(rows);
    } catch (err) {
      setParseErr(err.message || 'Failed to parse CSV.');
      setParsed([]);
    }
  };

  // Map departmentCode → id; collect parse-side errors before sending.
  const buildPayload = () => {
    const errs = [];
    const users = parsed.map((r, idx) => {
      const dept = departments.find(d =>
        d.code?.toLowerCase() === String(r.departmentCode || '').toLowerCase());
      if (!dept) {
        errs.push({ rowIndex: idx, username: r.username, message:
          `Department code '${r.departmentCode}' not found.` });
      }
      return {
        username:     r.username,
        firstName:    r.firstName,
        lastName:     r.lastName || undefined,
        initials:     (r.initials || '').toUpperCase(),
        joiningDate:  r.joiningDate || null,
        phone:        r.phone,
        email:        r.email || undefined,
        designation:  r.designation || undefined,
        departmentId: dept?.id,
        isDeptReviewer: toBool(r.isDeptReviewer),
        isQaReviewer:   toBool(r.isQaReviewer),
        password:     r.password || undefined,
        roleIds:      defaultRoleId ? [defaultRoleId] : undefined,
      };
    });
    return { users, errs };
  };

  const handleUpload = async () => {
    setUp(true); setUploadErr(null); setResult(null);
    try {
      const { users, errs } = buildPayload();
      // Pre-validation: if any rows reference an unknown dept code, abort early so
      // the operator can fix the file rather than receive a half-completed import.
      if (errs.length > 0) {
        setResult({ total: users.length, created: 0, failed: errs.length,
                    createdUsers: [], errors: errs });
        return;
      }
      const { data } = await bulkUploadUsersApi({
        users,
        autoGeneratePasswords: autoGen,
      });
      setResult(data?.data || null);
      if (data?.data?.created > 0) onUploaded?.();
    } catch (err) {
      setUploadErr(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUp(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose?.(); }} maxWidth="md" fullWidth>
      <DialogTitle>Bulk Upload Users</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Upload a CSV exported from HR. Mandatory columns: <code>username, firstName, initials,
          joiningDate, phone, departmentCode</code>. Surname and email are optional. Newly created
          users are <strong>not</strong> auto-licensed — assign licenses individually.
        </Alert>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<UploadIcon />} component="label">
            Choose CSV
            <input ref={fileRef} hidden type="file" accept=".csv,text/csv"
                   onChange={handleFile} />
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadSample}>
            Download sample
          </Button>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={<Switch checked={autoGen} onChange={e => setAutoGen(e.target.checked)} />}
            label="Auto-generate passwords"
          />
        </Stack>

        {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

        {parsed.length > 0 && !result && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Preview — {parsed.length} row{parsed.length === 1 ? '' : 's'}
            </Typography>
            <Box sx={{ maxHeight: 280, overflow: 'auto', mt: 0.5,
                       border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse',
                                            '& th, & td': { fontSize: 12, py: 0.5, px: 1, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left' },
                                            '& th': { fontWeight: 700, color: 'text.secondary' } }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Initials</th>
                    <th>Dept</th>
                    <th>Joining</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.username}</td>
                      <td>{[r.firstName, r.lastName].filter(Boolean).join(' ')}</td>
                      <td>{r.initials}</td>
                      <td>{r.departmentCode}</td>
                      <td>{r.joiningDate}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
            {parsed.length > 50 && (
              <Typography variant="caption" color="text.secondary">
                …and {parsed.length - 50} more.
              </Typography>
            )}
          </Box>
        )}

        {uploadErr && <Alert severity="error" sx={{ mt: 1 }}>{uploadErr}</Alert>}

        {result && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip icon={<OkIcon />}  color="success" label={`${result.created} created`} />
              <Chip icon={<ErrIcon />} color={result.failed ? 'error' : 'default'}
                    label={`${result.failed} failed`} variant={result.failed ? 'filled' : 'outlined'} />
              <Chip color="info" label={`${result.total} total`} variant="outlined" />
            </Stack>
            {result.errors?.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: 'auto',
                         border: '1px solid', borderColor: 'error.light',
                         borderRadius: 1.5, p: 1, bgcolor: 'error.50' }}>
                <Typography variant="caption" fontWeight={700}>Errors</Typography>
                {result.errors.map((e, i) => (
                  <Typography key={i} variant="caption" display="block" sx={{ mt: 0.3 }}>
                    Row {e.rowIndex + 1}{e.username ? ` (${e.username})` : ''}: {e.message}
                  </Typography>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { reset(); onClose?.(); }} disabled={uploading}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button variant="contained" onClick={handleUpload}
                  disabled={uploading || parsed.length === 0}>
            {uploading ? 'Uploading…' : `Upload ${parsed.length || ''} user${parsed.length === 1 ? '' : 's'}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkUserUploadDialog;
