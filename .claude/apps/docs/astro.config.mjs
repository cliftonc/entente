// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	output: 'static',
	integrations: [
		mermaid(),
		starlight({
			title: 'Entente Documentation',
			logo: {
				src: './src/assets/entente-logo.svg',
				replacesTitle: true,
			},
			favicon: '/favicon.svg',
			components: {
				Header: './src/components/Header.astro',
			},
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/svg+xml',
						href: '/favicon.svg',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/png',
						sizes: '32x32',
						href: '/favicon-32x32.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/png',
						sizes: '16x16',
						href: '/favicon-16x16.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'apple-touch-icon',
						sizes: '180x180',
						href: '/apple-touch-icon.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'manifest',
						href: '/site.webmanifest',
					},
				},
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/entente-dev/entente' },
				{ icon: 'external', label: 'Login', href: 'https://entente.dev' }
			],
			customCss: [
				'./src/styles/global.css',
			],
			sidebar: [
				{
					label: 'Introduction',
					items: [
						{ label: 'Overview', slug: 'introduction' },
						{ label: 'Walkthrough', slug: 'walkthrough' },
					],
				},
				{
					label: 'For Providers',
					items: [
						{ label: 'Getting Started', slug: 'providers' },
						{ label: 'OpenAPI Specs', slug: 'providers/openapi-specs' },
						{ label: 'Verification', slug: 'providers/verification' },
						{ label: 'GitHub Actions', slug: 'providers/github-actions' },
					],
				},
				{
					label: 'For Consumers',
					items: [
						{ label: 'Getting Started', slug: 'consumers' },
						{ label: 'Mock Servers', slug: 'consumers/mock-servers' },
					],
				},
				{
					label: 'GitHub Actions',
					items: [
						{ label: 'Overview', slug: 'github-actions' },
					],
				},
				{
					label: 'Fixtures',
					items: [
						{ label: 'Overview', slug: 'fixtures' },
					],
				},
			],
		}),
	],
});
