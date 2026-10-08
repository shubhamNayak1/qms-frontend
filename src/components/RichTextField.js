import React, { useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Box, Typography } from '@mui/material';

/**
 * RichTextField — the shared WYSIWYG input used by every QMS form that
 * accepts a long-form narrative (Existing System, Proposed System, Remark,
 * Justification across CC / CAPA / Deviation / Incident / Market Complaint).
 *
 * Powered by react-quill-new (a maintained fork of react-quill with React
 * 18+ support). The toolbar is a one-array config that maps 1:1 to the
 * features the tester requested — heading / size / colour / background /
 * numbered + bullet lists / bold + italic / alignment / link / image /
 * clear-formatting.
 *
 * Image handling:
 *   • If an `onImageUpload(file) => Promise<string>` prop is passed, the
 *     image button opens a file picker, calls the handler (expected to
 *     POST the file somewhere and return the final URL), and inserts an
 *     <img src="<url>">. This is the pharma-grade path — images live as
 *     DMS artefacts, not binary blobs in the `TEXT` column.
 *   • Without a handler, Quill's default base64 inline insertion is used.
 *     Fine for prototypes and quick drafts; bloats the DB on long-term use.
 *
 * The content is stored as HTML. The backend keeps the existing TEXT
 * columns; the PDF exporter strips HTML back to plain text until we
 * upgrade to OpenHTMLtoPDF (planned Batch R.3).
 */
const DEFAULT_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  [{ size: ['small', false, 'large', 'huge'] }],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['bold', 'italic'],
  [{ align: ['', 'center', 'right', 'justify'] }],
  ['link', 'image'],
  ['clean'],
];

const RichTextField = ({
  value,
  onChange,
  label,
  required,
  minHeight = 160,
  placeholder,
  onImageUpload,  // optional — see JSDoc above
  disabled,
  readOnly,
  error,          // string | undefined — shows red helper line underneath
  helperText,
}) => {
  const quillRef = useRef(null);

  // Image button handler. Opens a file picker; if the parent supplied
  // onImageUpload we await its URL and insert the <img> at the cursor.
  // Otherwise Quill's default (base64 inline) runs.
  const imageHandler = useMemo(() => {
    if (!onImageUpload) return undefined;
    return function handle() {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const url = await onImageUpload(file);
          if (!url) return;
          const editor = quillRef.current?.getEditor();
          const range = editor?.getSelection(true);
          editor?.insertEmbed(range?.index ?? 0, 'image', url, 'user');
          editor?.setSelection((range?.index ?? 0) + 1);
        } catch (err) {
          console.error('Image upload failed', err); // eslint-disable-line no-console
        }
      };
    };
  }, [onImageUpload]);

  const modules = useMemo(() => ({
    toolbar: {
      container: DEFAULT_TOOLBAR,
      ...(imageHandler && { handlers: { image: imageHandler } }),
    },
    clipboard: {
      // Strip the "msoNormal" style garbage Word pastes bring in; keep
      // paragraph breaks and basic formatting. Prevents hundreds of KB
      // of inline <span style="…"> noise from landing in the DB.
      matchVisual: false,
    },
  }), [imageHandler]);

  return (
    <Box
      sx={{
        '& .ql-toolbar': {
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderColor: error ? 'error.main' : 'divider',
        },
        '& .ql-container': {
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          borderColor: error ? 'error.main' : 'divider',
          minHeight,
          fontFamily: 'inherit',
          fontSize: 14,
        },
        '& .ql-editor': {
          minHeight,
        },
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {label && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.5,
            color: error ? 'error.main' : 'text.secondary',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {label}{required ? ' *' : ''}
        </Typography>
      )}
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        readOnly={!!readOnly}
      />
      {(error || helperText) && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: error ? 'error.main' : 'text.secondary',
            fontSize: 11,
          }}
        >
          {error || helperText}
        </Typography>
      )}
    </Box>
  );
};

export default RichTextField;
