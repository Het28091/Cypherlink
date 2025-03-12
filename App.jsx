// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import { 
  Container, 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment
} from '@mui/material';
import { 
  CloudUpload as CloudUploadIcon, 
  Delete as DeleteIcon, 
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [downloadKey, setDownloadKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [downloadDialog, setDownloadDialog] = useState({ open: false, fileId: null, fileName: '' });

  // Fetch files on mount
  useEffect(() => {
    fetchFiles();
    fetchLogs();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/files`);
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setMessage({ type: 'error', text: 'Failed to fetch files' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/logs`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    if (!encryptionKey) {
      setMessage({ type: 'error', text: 'Please enter an encryption key' });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('encryptionKey', encryptionKey);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'File uploaded successfully!' });
        setSelectedFile(null);
        fetchFiles();
        fetchLogs();
      } else {
        setMessage({ type: 'error', text: data.message || 'Upload failed' });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage({ type: 'error', text: 'Error uploading file' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/files/${fileId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'File deleted successfully!' });
        fetchFiles();
        fetchLogs();
      } else {
        setMessage({ type: 'error', text: data.message || 'Delete failed' });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setMessage({ type: 'error', text: 'Error deleting file' });
    } finally {
      setLoading(false);
    }
  };

  const openDownloadDialog = (fileId, fileName) => {
    setDownloadDialog({ open: true, fileId, fileName });
    setDownloadKey('');
  };

  const handleDownload = async () => {
    if (!downloadKey) {
      setMessage({ type: 'error', text: 'Please enter the decryption key' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/download/${downloadDialog.fileId}?encryptionKey=${encodeURIComponent(downloadKey)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadDialog.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage({ type: 'success', text: 'File downloaded successfully!' });
      setDownloadDialog({ open: false, fileId: null, fileName: '' });
      fetchLogs();
    } catch (error) {
      console.error('Error downloading file:', error);
      setMessage({ type: 'error', text: error.message || 'Error downloading file' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Secure File Storage
        </Typography>
        
        {message.text && (
          <Alert 
            severity={message.type} 
            onClose={() => setMessage({ type: '', text: '' })}
            sx={{ mb: 2 }}
          >
            {message.text}
          </Alert>
        )}

        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)} 
          centered
          sx={{ mb: 3 }}
        >
          <Tab label="Files" />
          <Tab label="Activity Logs" />
        </Tabs>

        {tabValue === 0 && (
          <>
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Upload Encrypted File
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  sx={{ flexGrow: 1 }}
                >
                  Select File
                  <input
                    type="file"
                    hidden
                    onChange={handleFileChange}
                  />
                </Button>
                <TextField
                  label="Encryption Key"
                  variant="outlined"
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.target.value)}
                  sx={{ flexGrow: 2 }}
                  type={showPassword ? 'text' : 'password'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleUpload}
                  disabled={!selectedFile || !encryptionKey || loading}
                  sx={{ flexGrow: 1 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Upload'}
                </Button>
              </Box>
              {selectedFile && (
                <Typography variant="body2" color="textSecondary">
                  Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </Typography>
              )}
            </Paper>

            <Typography variant="h6" gutterBottom>
              Stored Files
            </Typography>
            
            {loading && !files.length ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>File Name</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Uploaded</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">No files found</TableCell>
                      </TableRow>
                    ) : (
                      files.map((file) => (
                        <TableRow key={file.fileId}>
                          <TableCell>{file.fileName}</TableCell>
                          <TableCell>{formatBytes(file.size)}</TableCell>
                          <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                          <TableCell align="right">
                            <IconButton 
                              color="primary" 
                              onClick={() => openDownloadDialog(file.fileId, file.fileName)}
                            >
                              <DownloadIcon />
                            </IconButton>
                            <IconButton 
                              color="error" 
                              onClick={() => handleDelete(file.fileId)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {tabValue === 1 && (
          <>
            <Typography variant="h6" gutterBottom>
              Activity Logs
            </Typography>
            
            {loading && !logs.length ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No logs found</TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.logId}>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.details}</TableCell>
                          <TableCell>{formatDate(log.timestamp)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Box>

      <Dialog open={downloadDialog.open} onClose={() => setDownloadDialog({ open: false, fileId: null, fileName: '' })}>
        <DialogTitle>Download Encrypted File</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Enter the decryption key for: <strong>{downloadDialog.fileName}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Decryption Key"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={downloadKey}
            onChange={(e) => setDownloadKey(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadDialog({ open: false, fileId: null, fileName: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleDownload} 
            color="primary" 
            disabled={!downloadKey || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Download'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;