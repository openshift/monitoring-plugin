#!/usr/bin/env node

/**
 * CLI tool to validate YAML fixture files against the JSON schema
 * Usage: npm run ts-node validate-fixtures.ts <fixture-file.yaml>
 * Or from web directory: npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';

// Load the schema
const schemaPath = path.join(__dirname, 'fixture-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Set up validator
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

function validateFixture(filePath: string): boolean {
  try {
    console.log(`Validating: ${filePath}`);
    
    // Read and parse YAML
    const yamlContent = fs.readFileSync(filePath, 'utf8');
    const fixture = yaml.load(yamlContent);
    
    // Validate against schema
    const valid = validate(fixture);
    
    if (valid) {
      console.log(`VALID: ${filePath}`);
      console.log(`   Name: ${(fixture as any).name}`);
      console.log(`   Incidents: ${(fixture as any).incidents?.length || 0}`);
      return true;
    } else {
      console.log(`INVALID: ${filePath}`);
      validate.errors?.forEach(error => {
        const errorPath = error.instancePath || 'root';
        console.log(`   ${errorPath}: ${error.message}`);
      });
      return false;
    }
  } catch (error) {
    console.log(`PARSE ERROR: ${filePath}`);
    console.log(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Main execution
const args: string[] = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: npm run ts-node validate-fixtures.ts <fixture-file.yaml> [<file2.yaml> ...]');
  console.log('   or: npm run ts-node validate-fixtures.ts --all (validates all .yaml files in fixtures directory)');
  console.log('From web directory: npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- --all');
  process.exit(1);
}

let allValid = true;

if (args[0] === '--all') {
  // Validate all YAML files in the fixtures directory
  const fixturesDir = path.join(__dirname, '../../../fixtures/incident-scenarios');
  
  if (!fs.existsSync(fixturesDir)) {
    console.log(`ERROR: Fixtures directory not found: ${fixturesDir}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(fixturesDir)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
  
  if (files.length === 0) {
    console.log('No YAML fixture files found');
    process.exit(0);
  }
  
  console.log(`Found ${files.length} YAML fixture files:`);
  console.log('');
  
  files.forEach(file => {
    const filePath = path.join(fixturesDir, file);
    const valid = validateFixture(filePath);
    if (!valid) allValid = false;
    console.log('');
  });
} else {
  // Validate specific files
  args.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`ERROR: File not found: ${filePath}`);
      allValid = false;
      return;
    }
    
    const valid = validateFixture(filePath);
    if (!valid) allValid = false;
    console.log('');
  });
}

process.exit(allValid ? 0 : 1);