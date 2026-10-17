import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../renderer/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: [],
};

export default config;
