import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure Monaco environment
loader.config({
  monaco,
  paths: {
    vs: '/node_modules/monaco-editor/min/vs', // Adjust if using a CDN
  },
});

export default loader;