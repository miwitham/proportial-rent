import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          minWidth: "240px",
        },
      },
    },
  },
  palette: {
    mode: "dark",
  },
});
