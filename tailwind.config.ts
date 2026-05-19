import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#12312f",
        medical: "#237b68",
        cyanSoft: "#e8f6ef",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(25, 105, 89, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
