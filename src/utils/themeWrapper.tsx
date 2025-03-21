'use client';

import { muiTheme } from "@/styles/theme";
import { ThemeProvider } from "@mui/material/styles";

export default function Theme({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={muiTheme}>
            {children}
        </ThemeProvider>
    )
}