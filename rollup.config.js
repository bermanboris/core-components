import { ScriptTarget } from 'typescript';
import path from 'path';
import multiInput from 'rollup-plugin-multi-input';
import postcss, { addCssImports } from '@alfalab/rollup-plugin-postcss';
import typescript from '@wessberg/rollup-plugin-ts';
import stringHash from 'string-hash';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';

import {
    coreComponentsRootPackageResolver,
    coreComponentsResolver,
} from './tools/rollup/core-components-resolver';
import ignoreCss from './tools/rollup/ignore-css';
import processCss from './tools/rollup/process-css';
import coreComponentsTypingsResolver from './tools/rollup/core-components-typings-resolver';
import createPackageJson from './tools/rollup/create-package-json';

const currentPackageDir = process.cwd();
const currentPkg = path.join(currentPackageDir, 'package.json');

const pkg = require(currentPkg);

const currentComponentName = pkg.name.replace('@alfalab/core-components-', '');

const baseConfig = {
    input: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.{test,stories}.{ts,tsx}',
        '!src/**/*.mdx',
        '!src/**/*.d.ts',
    ],
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
};

const multiInputPlugin = multiInput();

const postcssPlugin = postcss({
    modules: {
        generateScopedName: function(name, fileName) {
            const folderName = path.basename(path.dirname(fileName));

            const str = `${pkg.name}@${pkg.version}@${folderName}`;

            const hash = stringHash(str)
                .toString(36)
                .substr(0, 5);

            return `${currentComponentName}__${name}_${hash}`;
        },
    },
    extract: true,
    separateCssFiles: true,
});

/**
 * Сборка ES5 с commonjs модулями.
 */
const es5 = {
    ...baseConfig,
    output: [
        {
            dir: 'dist',
            format: 'cjs',
            plugins: [addCssImports({ currentPackageDir })],
        },
    ],
    plugins: [
        multiInputPlugin,
        typescript({
            tsconfig: resolvedConfig => ({
                ...resolvedConfig,
                tsBuildInfoFile: 'tsconfig.tsbuildinfo',
            }),
        }),
        json(),
        postcssPlugin,
        copy({
            flatten: false,
            targets: [{ src: 'src/**/*.{png,svg,jpg,jpeg}', dest: `dist` }],
        }),
    ],
};

/**
 * Сборка ES2020 с esm модулями.
 */
const modern = {
    ...baseConfig,
    output: [
        {
            dir: 'dist/modern',
            format: 'esm',
            plugins: [
                addCssImports({ currentPackageDir }),
                coreComponentsResolver({ importFrom: 'dist/modern' }),
            ],
        },
    ],
    plugins: [
        multiInputPlugin,
        typescript({
            outDir: 'dist/modern',
            tsconfig: resolvedConfig => ({
                ...resolvedConfig,
                target: ScriptTarget.ES2020,
                tsBuildInfoFile: 'tsconfig.tsbuildinfo',
            }),
        }),
        json(),
        postcssPlugin,
        copy({
            flatten: false,
            targets: [{ src: 'src/**/*.{png,svg,jpg,jpeg}', dest: `dist/modern` }],
        }),
    ],
};

/**
 * Сборка ES5 с commonjs модулями.
 * Css-модули поставляются как есть, не компилируются.
 */
const cssm = {
    ...baseConfig,
    output: [
        {
            dir: 'dist/cssm',
            format: 'cjs',
            plugins: [coreComponentsResolver({ importFrom: 'dist/cssm' })],
        },
    ],
    plugins: [
        multiInputPlugin,
        ignoreCss(),
        typescript({
            outDir: 'dist/cssm',
            tsconfig: resolvedConfig => ({
                ...resolvedConfig,
                tsBuildInfoFile: 'tsconfig.tsbuildinfo',
            }),
        }),
        json(),
        processCss(),
        copy({
            flatten: false,
            targets: [{ src: 'src/**/*.{png,svg,jpg,jpeg}', dest: `dist/cssm` }],
        }),
    ],
};

/**
 * Сборка ES5 с esm модулями.
 */
const esm = {
    ...baseConfig,
    output: [
        {
            dir: 'dist/esm',
            format: 'esm',
            plugins: [
                addCssImports({ currentPackageDir }),
                coreComponentsResolver({ importFrom: 'dist/esm' }),
            ],
        },
    ],
    plugins: [
        multiInputPlugin,
        typescript({
            outDir: 'dist/esm',
            tsconfig: resolvedConfig => ({
                ...resolvedConfig,
                tsBuildInfoFile: 'tsconfig.tsbuildinfo',
            }),
        }),
        json(),
        postcssPlugin,
        copy({
            flatten: false,
            targets: [{ src: 'src/**/*.{png,svg,jpg,jpeg}', dest: `dist/esm` }],
        }),
    ],
};

const rootDir = `../../dist/${currentComponentName}`;

const root = {
    input: ['dist/**/*.js'],
    external: baseConfig.external,
    plugins: [
        multiInput({
            relative: 'dist',
        }),
        copy({
            flatten: false,
            targets: [
                { src: ['dist/**/*', '!**/*.js'], dest: rootDir },
                {
                    src: 'package.json',
                    dest: `../../dist/${currentComponentName}`,
                    transform: () => createPackageJson('./esm/index.js'),
                },
            ],
        }),
        coreComponentsRootPackageResolver({ currentPackageDir }),
    ],
    output: [
        {
            dir: rootDir,
            plugins: [coreComponentsTypingsResolver({ rootDir })],
        },
    ],
};

export default [es5, modern, cssm, esm, root];
