import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
} from '@mui/material';
import {
  CloudUpload as UploadIcon, AttachFile as AttachFileIcon,
  Download as DownloadIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  uploadRecordAttachmentApi, listRecordAttachmentsApi, downloadRecordAttachmentApi,
} from '../../api/qmsCommonApi';

const RECORD_TYPE_FOR_MODULE = {
  capa: 'CAPA',
  deviation: 'DEVIATION',
  incident: 'INCIDENT',
  marketComplaint: 'MARKET_COMPLAINT',
  changeControl: 'CHANGE_CONTROL',
};

/**
 * StageAttachments — reusable local-file attachment list for any QMS
 * record, at any workflow stage (Round-2 H4).
 *
 * Renders a heading + list of already-uploaded files + a Browse button to
 * upload another. Files are stored against (recordType, recordId) in
 * qms_record_attachments and are visible at every stage thereafter.
 *
 * Props
 *   moduleKey  — 'changeControl' | 'capa' | 'deviation' | 'incident' | 'marketComplaint'
 *   recordId   — numeric record id
 *   readOnly   — when true, hides the Browse button (used on terminal stages)
 *   heading    — optional override (defaults to "Stage attachments")
 */
const StageAttachments = ({ moduleKey, recordId, readOnly = false, heading }) => {
  const recordType = RECORD_TYPE_FOR_MODULE[moduleKey];
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!recordType || !recordId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await listRecordAttachmentsApi(recordType, recordId);
      setRows(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attachments.');
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-pick of same file
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB. Check it into DMS first and reference its document id instead.');
      return;
    }
    setUploading(true); setError(null);
    try {
      await uploadRecordAttachmentApi(f, recordType, recordId);
      await fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (row) => {
    try {
      const res = await downloadRecordAttachmentApi(row.id);
      const blob = new Blob([res.data], { type: row.contentType || 'application/octet-stream' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = row.fileName || 'attachment'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed.');
    }
  };

  return (
    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, p: 1.5, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <AttachFileIcon fontSize="small" color="primary" />
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4, flex: 1 }}>
          {(heading || 'STAGE ATTACHMENTS').toUpperCase()}
          {rows.length > 0 && (
            <Chip size="small" label={rows.length} sx={{ ml: 1, height: 18 }} />
          )}
        </Typography>
        <Tooltip title="Refresh"><span>
          <IconButton size="small" onClick={fetch} disabled={loading}>
            <RefreshIcon fontSize="inherit" />
          </IconButton>
        </span></Tooltip>
        {!readOnly && (
          <Button size="small" startIcon={<UploadIcon />} component="label"
                  disabled={uploading}>
            {uploading ? 'Uploading…' : 'Add file'}
            <input
              type="file" hidden
              accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.gif,.bmp,.xlsx,.xls,.txt,.csv"
              onChange={handleFile}
            />
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {rows.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          {readOnly ? 'No attachments.' : 'No files uploaded yet. Use "Add file" to attach evidence at this stage.'}
        </Typography>
      ) : (
        <Stack spacing={0.8}>
          {rows.map((r) => (
            <Box key={r.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1, py: 0.5, borderRadius: 1, bgcolor: 'grey.50',
                border: '1px solid', borderColor: 'divider',
              }}>
              <AttachFileIcon fontSize="small" color="action" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap title={r.fileName}>
                  {r.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(r.sizeBytes / 1024).toFixed(0)} KB · {r.uploadedBy || '—'}
                </Typography>
              </Box>
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => handleDownload(r)}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default StageAttachments;
