import { globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const projectIgnores = globalIgnores([
  '.next/**',
  'out/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'supabase/.temp/**',
]);

const compatibilityRules = {
  rules: {
    // Existing async data-loading effects rely on this established pattern.
    'react-hooks/set-state-in-effect': 'off',
  },
};

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, projectIgnores, compatibilityRules];

export default eslintConfig;
