import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
    palette: {
        primary: {
            main: '#7B5AFF',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#4A25E0',
            contrastText: '#FFFFFF',
        },
    },
    typography: {
        fontFamily: 'var(--font-space-grotesk)'
    },
    components: {
        
    },
});
