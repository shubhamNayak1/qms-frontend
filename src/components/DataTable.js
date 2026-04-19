import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Paper, Skeleton, Typography, Box,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

const DataTable = ({
  columns = [],
  rows = [],
  loading = false,
  totalCount = 0,
  page = 0,
  rowsPerPage = 10,
  onPageChange,
  onRowsPerPageChange,
  emptyMessage = 'No records found.',
}) => {
  const skeletonRows = Array.from({ length: rowsPerPage });

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field} align={col.align || 'left'} sx={{ minWidth: col.minWidth }}>
                  {col.headerName}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? skeletonRows.map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.field}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                        <InboxIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                        <Typography variant="body2">{emptyMessage}</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              : rows.map((row, idx) => (
                  <TableRow key={row.id ?? idx} hover>
                    {columns.map((col) => (
                      <TableCell key={col.field} align={col.align || 'left'}>
                        {col.renderCell ? col.renderCell(row) : row[col.field]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
      {onPageChange && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      )}
    </Paper>
  );
};

export default DataTable;
