import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Grid, Alert, Box, Typography,
  CircularProgress, FormControlLabel, Switch, Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { uploadDocumentApi, uploadNewVersionApi } from '../../api/dmsApi';

// ── Constants ──────────────────────────────────────────────────────────────
export const DOC_CATEGORIES = [
  { value: 'SOP',               label: 'SOP – Standard Operating Procedure' },
  { value: 'POLICY',            label: 'Policy' },
  { value: 'WORK_INSTRUCTION',  label: 'Work Instruction' },
  { value: 'FORM',              label: 'Form / Template' },
  { value: 'RECORD',            label: 'Record' },
  { value: 'SPECIFICATION',     label: 'Specification' },
  { value: 'PROTOCOL',          label: 'Protocol' },
  { value: 'REPORT',            label: 'Report' },
  { value: 'REGULATORY',        label: 'Regulatory' },
  { value: 'TRAINING_MATERIAL', label: 'Training Material' },
  { value: 'RISK_ASSESSMENT',   label: 'Risk Assessment' },
  { value: 'OTHER',             label: 'Other' },
];

export const ACCESS_LEVELS = [
  { value: 'PUBLIC',       label: 'Public — any authenticated user' },
  { value: 'RESTRICTED',   label: 'Restricted — specific roles / departments' },
  { value: 'CONFIDENTIAL', label: 'Confidential — QA Manager and above' },
  { value: 'TOP_SECRET',   label: 'Top Secret — Super Admin + named users' },
];

const EMPTY_FORM = {
  title:         '',
  category:      'SOP',
  description:   '',
  department:    '',
  tags:          '',
  accessLevel:   'PUBLIC',
  effectiveDate: '',
  reviewDate:    '',
  expiryDate:    '',
  changeSummary: '',
  isControlled:  false,
};

// ── File Drop Zone ─────────────────────────────────────────────────────────
const FileDropZone = ({ file, onChange }) => {
  const ref = useRef();
  return (
    <Box
      sx={{
        p: 2.5, border: '2px dashed', borderRadius: 2, textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
        borderColor: file ? 'primary.main' : 'grey.300',
        bgcolor:     file ? 'primary.50'   : 'grey.50',
        '&:hover':   { borderColor: 'primary.main', bgcolor: 'primary.50' },
      }}
      onClick={() => ref.current?.click()}
    >
      {file ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <FileIcon color="primary" />
          <Typography variant="body2" color="primary.main" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
            {file.name}
          </Typography>
          <Chip
            label={file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(0)} KB`
              : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
            size="small"
          />
        </Box>
      ) : (
        <>
          <UploadIcon sx={{ fontSize: 32, color: 'grey.400', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            Click to select a file
          </Typography>
          <Typography variant="caption" color="text.disabled">
            PDF, DOCX, XLSX, PNG…
          </Typography>
        </>
      )}
      <input ref={ref} type="file" hidden onChange={(e) => onChange(e.target.files[0])} />
    </Box>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
// newVersionFor: pass a document object to upload a new version of it
const UploadDocumentDialog = ({ open, onClose, onUploaded, newVersionFor = null }) => {
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [file,      setFile]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState(null);

  const isNewVersion = !!newVersionFor;

  const reset = () => { setForm(EMPTY_FORM); setFile(null); setError(null); };
  const handleClose = () => { reset(); onClose(); };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleUpload = async () => {
    if (!file)               { setError('Please select a file.'); return; }
    if (!form.title.trim())  { setError('Document title is required.'); return; }
    setUploading(true);
    setError(null);
    try {
      const metadata = {
        title:         form.title.trim(),
        category:      form.category,
        description:   form.description.trim()   || undefined,
        department:    form.department.trim()     || undefined,
        tags:          form.tags
                         ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
                         : undefined,
        accessLevel:   form.accessLevel,
        effectiveDate: form.effectiveDate         || undefined,
        reviewDate:    form.reviewDate            || undefined,
        expiryDate:    form.expiryDate            || undefined,
        changeSummary: form.changeSummary.trim()  || undefined,
        isControlled:  form.isControlled,
      };
      const fd = new FormData();
      fd.append('file', file);
      fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

      if (isNewVersion) {
        await uploadNewVersionApi(newVersionFor.id, fd);
      } else {
        await uploadDocumentApi(fd);
      }
      onUploaded();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isNewVersion
          ? `New Version — ${newVersionFor?.title}`
          : 'Upload Document'}
        {isNewVersion && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            Current: v{newVersionFor?.currentVersion} · {newVersionFor?.documentNumber}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* Title */}
          <Grid item xs={12}>
            <TextField
              label="Document Title" required fullWidth size="small"
              value={form.title} onChange={set('title')}
            />
          </Grid>

          {/* Category + Access Level */}
          <Grid item xs={6}>
            <TextField
              label="Category" select required fullWidth size="small"
              value={form.category} onChange={set('category')}
            >
              {DOC_CATEGORIES.map(({ value, label }) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Access Level" select fullWidth size="small"
              value={form.accessLevel} onChange={set('accessLevel')}
            >
              {ACCESS_LEVELS.map(({ value, label }) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Department + Tags */}
          <Grid item xs={6}>
            <TextField
              label="Department (optional)" fullWidth size="small"
              value={form.department} onChange={set('department')}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Tags (comma-separated)" fullWidth size="small"
              value={form.tags} onChange={set('tags')}
              placeholder="quality, sop, production"
            />
          </Grid>

          {/* Dates */}
          <Grid item xs={4}>
            <TextField
              label="Effective Date" type="date" fullWidth size="small"
              InputLabelProps={{ shrink: true }}
              value={form.effectiveDate} onChange={set('effectiveDate')}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Review Date" type="date" fullWidth size="small"
              InputLabelProps={{ shrink: true }}
              value={form.reviewDate} onChange={set('reviewDate')}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Expiry Date" type="date" fullWidth size="small"
              InputLabelProps={{ shrink: true }}
              value={form.expiryDate} onChange={set('expiryDate')}
            />
          </Grid>

          {/* Description */}
          <Grid item xs={12}>
            <TextField
              label="Description (optional)" fullWidth size="small" multiline rows={2}
              value={form.description} onChange={set('description')}
            />
          </Grid>

          {/* Change Summary */}
          <Grid item xs={12}>
            <TextField
              label="Change Summary (optional)" fullWidth size="small" multiline rows={2}
              value={form.changeSummary} onChange={set('changeSummary')}
              placeholder="Describe what changed in this version"
            />
          </Grid>

          {/* Controlled toggle */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isControlled}
                  onChange={(e) => setForm((f) => ({ ...f, isControlled: e.target.checked }))}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" component="span">
                    Controlled Document
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                    (requires acknowledgement after download)
                  </Typography>
                </Box>
              }
            />
          </Grid>

          {/* File drop zone */}
          <Grid item xs={12}>
            <FileDropZone file={file} onChange={setFile} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={uploading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={uploading}
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
        >
          {uploading
            ? 'Uploading…'
            : isNewVersion ? 'Upload New Version' : 'Upload Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadDocumentDialog;
