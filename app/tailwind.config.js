/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      colors: {
        // ALKÜ brand colors — also available as CSS vars in index.css
        "alku-turquoise": "hsl(192, 100%, 40%)",
        "alku-navy": "hsl(218, 63%, 30%)",
        "alku-gold": "hsl(43, 60%, 57%)",
      },
    },
  },
  plugins: [],
};
