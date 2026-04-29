import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Alert, CircularProgress, Typography, Box,
  TextField, Chip, Autocomplete, Checkbox,
} from '@mui/material';
import { bulkEnrollApi } from '../../api/lmsApi';
import { getUsersApi } from '../../api/userApi';

const PAGE_SIZE = 20;

// Sentinel object appended to options list when more pages are loading
const LOADER_OPTION = Object.freeze({ id: -1, _isLoader: true, fullName: '' });

const EnrollDialog = ({ open, onClose, onEnrolled, programId, programTitle }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [options,        setOptions]       = useState([]);
  const [inputValue,     setInputValue]    = useState('');
  const [searchTerm,     setSearchTerm]    = useState('');
  const [page,           setPage]          = useState(0);
  const [hasMore,        setHasMore]       = useState(false);
  const [loading,        setLoading]       = useState(false);
  const [loadingMore,    setLoadingMore]   = useState(false);
  const [dueDate,        setDueDate]       = useState('');
  const [reason,         setReason]        = useState('');
  const [saving,         setSaving]        = useState(false);
  const [error,          setError]         = useState(null);

  const debounceTimer  = useRef(null);
  // ref keeps loadingMore value accessible in scroll handler without stale closure
  const loadingMoreRef = useRef(false);
  const hasMoreRef     = useRef(false);
  const searchTermRef  = useRef('');

  loadingMoreRef.current = loadingMore;
  hasMoreRef.current     = hasMore;
  searchTermRef.current  = searchTerm;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (term, pageNum) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getUsersApi({
        search:   term || undefined,
        isActive: true,
        page:     pageNum,
        size:     PAGE_SIZE,
      });
      const content    = res.data?.data?.content    || [];
      const totalPages = res.data?.data?.totalPages ?? 1;
      if (pageNum === 0) setOptions(content);
      else setOptions(prev => [...prev, ...content]);
      setHasMore(pageNum + 1 < totalPages);
    } catch (_) {
      /* swallow search errors */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reset & fetch when dialog opens or debounced search term changes
  useEffect(() => {
    if (!open) return;
    setPage(0);
    fetchUsers(searchTerm, 0);
  }, [open, searchTerm, fetchUsers]);

  // Append next page (page increments only from scroll handler)
  useEffect(() => {
    if (page === 0) return;
    fetchUsers(searchTermRef.current, page);
  }, [page, fetchUsers]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInputChange = useCallback((_e, value, reason) => {
    if (reason !== 'input') return;
    setInputValue(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSearchTerm(value), 350);
  }, []);

  const handleListboxScroll = useCallback((e) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom && hasMoreRef.current && !loadingMoreRef.current) {
      setPage(prev => prev + 1);
    }
  }, []);

  const handleClose = () => {
    clearTimeout(debounceTimer.current);
    setSelectedUsers([]);
    setOptions([]);
    setInputValue('');
    setSearchTerm('');
    setPage(0);
    setHasMore(false);
    setDueDate('');
    setReason('');
    setError(null);
    onClose();
  };

  const handleEnroll = async () => {
    if (!selectedUsers.length) { setError('Select at least one user.'); return; }
    setSaving(true);
    setError(null);
    try {
      await bulkEnrollApi({
        programId,
        userIds:          selectedUsers.map(u => u.id),
        dueDate:          dueDate  || undefined,
        assignmentReason: reason   || undefined,
      });
      onEnrolled();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Enrollment failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived list (append loader sentinel while fetching next page) ─────────
  const displayOptions = loadingMore
    ? [...options, LOADER_OPTION]
    : options;

  const getUserLabel = (u) =>
    u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || String(u.id);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Enroll Users</DialogTitle>

      <DialogContent dividers>
        {programTitle && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Program</Typography>
            <Typography variant="body2" fontWeight={600}>{programTitle}</Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Multi-Select User Picker ─────────────────────────────────── */}
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={displayOptions}
          value={selectedUsers}
          inputValue={inputValue}
          onChange={(_e, val) =>
            // Filter out loader sentinel from selection
            setSelectedUsers(val.filter(u => !u._isLoader))
          }
          onInputChange={handleInputChange}
          // Disable client-side filtering — server handles it
          filterOptions={(x) => x}
          getOptionLabel={(u) => u._isLoader ? '' : getUserLabel(u)}
          isOptionEqualToValue={(a, b) =>
            !a._isLoader && !b._isLoader && a.id === b.id
          }
          getOptionDisabled={(u) => u._isLoader === true}
          loading={loading}
          noOptionsText={loading ? 'Searching…' : 'No users found'}
          ListboxProps={{
            onScroll: handleListboxScroll,
            style:    { maxHeight: 240, overflow: 'auto' },
          }}

          renderOption={(props, option, { selected }) => {
            // Loader row at the bottom of the list
            if (option._isLoader) {
              return (
                <Box
                  component="li"
                  {...props}
                  key="__loader__"
                  sx={{
                    justifyContent: 'center',
                    py: 1,
                    pointerEvents: 'none',
                    gap: 1,
                  }}
                >
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Loading more…
                  </Typography>
                </Box>
              );
            }

            return (
              <Box
                component="li"
                {...props}
                key={option.id}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: '6px !important' }}
              >
                <Checkbox
                  size="small"
                  checked={selected}
                  sx={{ p: 0, mt: '2px', flexShrink: 0 }}
                  tabIndex={-1}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {getUserLabel(option)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[option.employeeId, option.department, option.designation]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
              </Box>
            );
          }}

          renderTags={(vals, getTagProps) =>
            vals.map((u, i) => (
              <Chip
                key={u.id}
                label={getUserLabel(u)}
                size="small"
                {...getTagProps({ index: i })}
              />
            ))
          }

          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Users"
              size="small"
              placeholder={
                selectedUsers.length
                  ? ''
                  : 'Search by name, email or employee ID…'
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && (
                      <CircularProgress
                        size={16}
                        sx={{ mr: 1, color: 'text.secondary' }}
                      />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
        />

        {/* Due date */}
        <TextField
          label="Due Date (optional)"
          type="date"
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        {/* Reason */}
        <TextField
          label="Assignment Reason (optional)"
          fullWidth
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Annual GMP refresh"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleEnroll}
          disabled={saving || !selectedUsers.length}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving
            ? 'Enrolling…'
            : `Enroll${selectedUsers.length ? ` (${selectedUsers.length})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnrollDialog;
