import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// Routiq Brand Colors
  			routiq: {
  				core: 'rgb(var(--routiq-core))',
  				blackberry: 'rgb(var(--routiq-blackberry))',
  				energy: 'rgb(var(--routiq-energy))',
  				prompt: 'rgb(var(--routiq-prompt))',
  				cloud: 'rgb(var(--routiq-cloud))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		animation: {
  			gradient: "gradient var(--duration, 2s) ease infinite",
  			"shimmer-slide": "shimmer-slide var(--duration, 1s) ease-in-out infinite alternate",
  			"spin-around": "spin-around calc(var(--duration, 1) * 1s) infinite linear",
  			"routiq-pulse": "routiq-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  			"routiq-float": "routiq-float 3s ease-in-out infinite",
  			"routiq-spin": "routiq-spin 1s linear infinite",
  			"routiq-fade-in": "routiq-fade-in 0.5s ease-in-out",
  		},
  		keyframes: {
  			gradient: {
  				to: {
  					backgroundPosition: "var(--bg-size) 0",
  				},
  			},
  			"shimmer-slide": {
  				to: {
  					transform: "translate(calc(100cqw - 100%), 0)",
  				},
  			},
  			"spin-around": {
  				"0%": {
  					transform: "translateZ(0) rotate(0)",
  				},
  				"15%, 35%": {
  					transform: "translateZ(0) rotate(90deg)",
  				},
  				"65%, 85%": {
  					transform: "translateZ(0) rotate(270deg)",
  				},
  				"100%": {
  					transform: "translateZ(0) rotate(360deg)",
  				},
  			},
  			"routiq-pulse": {
  				"0%, 100%": {
  					opacity: "1",
  				},
  				"50%": {
  					opacity: "0.8",
  				},
  			},
  			"routiq-float": {
  				"0%, 100%": {
  					transform: "translateY(0px)",
  				},
  				"50%": {
  					transform: "translateY(-10px)",
  				},
  			},
  			"routiq-spin": {
  				"0%": {
  					transform: "rotate(0deg)",
  				},
  				"100%": {
  					transform: "rotate(360deg)",
  				},
  			},
  			"routiq-fade-in": {
  				"0%": {
  					opacity: "0",
  					transform: "translateY(10px)",
  				},
  				"100%": {
  					opacity: "1",
  					transform: "translateY(0px)",
  				},
  			},
  		},
  	}
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
