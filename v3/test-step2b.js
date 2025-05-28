#!/usr/bin/env node

/**
 * Step 2B Backend API Foundation Test Suite
 * Tests all template management endpoints and validates responses
 */

const { TemplateClient } = require('./src/api-clients');

class Step2BTestSuite {
  constructor() {
    this.client = new TemplateClient('http://localhost:3000');
    this.testResults = [];
    this.createdTemplateIds = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async test(description, testFn) {
    try {
      this.log(`Testing: ${description}`);
      await testFn();
      this.testResults.push({ description, status: 'PASS' });
      this.log(`${description} - PASSED`, 'pass');
    } catch (error) {
      this.testResults.push({ description, status: 'FAIL', error: error.message });
      this.log(`${description} - FAILED: ${error.message}`, 'fail');
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Step 2B Backend API Test Suite\n');

    // Test 1: Server Health Check
    await this.test('Server Health Check', async () => {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) throw new Error('Server not responding');
      const health = await response.json();
      if (health.status !== 'ok') throw new Error('Server not healthy');
    });

    // Test 2: Get Templates (should have at least Default)
    await this.test('Get All Templates', async () => {
      const templates = await this.client.getTemplates();
      if (!Array.isArray(templates)) throw new Error('Templates should be an array');
      if (templates.length === 0) throw new Error('Should have at least one template');
      
      const defaultTemplate = templates.find(t => t.name === 'Default');
      if (!defaultTemplate) throw new Error('Default template not found');
      if (!defaultTemplate.is_active) throw new Error('Default template should be active');
      
      this.log(`Found ${templates.length} templates including Default`);
    });

    // Test 3: Get Active Template
    await this.test('Get Active Template', async () => {
      const activeTemplate = await this.client.getActiveTemplate();
      if (!activeTemplate) throw new Error('No active template found');
      if (!activeTemplate.name) throw new Error('Active template missing name');
      if (!activeTemplate.criteria) throw new Error('Active template missing criteria');
      if (!Array.isArray(activeTemplate.criteria)) throw new Error('Criteria should be an array');
      
      this.log(`Active template: ${activeTemplate.name} with ${activeTemplate.criteria.length} criteria`);
    });

    // Test 4: Create Template without Copying
    await this.test('Create Empty Template', async () => {
      const result = await this.client.createTemplate('Test Empty Template', null, false);
      if (!result.success) throw new Error('Template creation failed');
      if (!result.template) throw new Error('No template returned');
      if (!result.template.id) throw new Error('Template missing ID');
      
      this.createdTemplateIds.push(result.template.id);
      this.log(`Created template ID: ${result.template.id}`);
    });

    // Test 5: Create Template with Copying
    await this.test('Create Template by Copying', async () => {
      // Get the Default template ID first
      const templates = await this.client.getTemplates();
      const defaultTemplate = templates.find(t => t.name === 'Default');
      
      const result = await this.client.createTemplate('Test Copied Template', defaultTemplate.id, false);
      if (!result.success) throw new Error('Template creation failed');
      if (!result.template) throw new Error('No template returned');
      
      this.createdTemplateIds.push(result.template.id);
      this.log(`Created copied template ID: ${result.template.id}`);
    });

    // Test 6: Verify Template Count
    await this.test('Verify Template Count Increased', async () => {
      const templates = await this.client.getTemplates();
      const expectedCount = 3; // Default + 2 created
      if (templates.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} templates, found ${templates.length}`);
      }
      this.log(`Confirmed ${templates.length} templates exist`);
    });

    // Test 7: Template Activation
    await this.test('Template Activation', async () => {
      const templateId = this.createdTemplateIds[0];
      const result = await this.client.setActiveTemplate(templateId);
      if (!result.success) throw new Error('Template activation failed');
      
      // Verify it's now active
      const activeTemplate = await this.client.getActiveTemplate();
      if (activeTemplate.id !== templateId) {
        throw new Error('Template activation did not take effect');
      }
      this.log(`Successfully activated template ID: ${templateId}`);
    });

    // Test 8: Only One Active Template
    await this.test('Verify Only One Active Template', async () => {
      const templates = await this.client.getTemplates();
      const activeTemplates = templates.filter(t => t.is_active);
      if (activeTemplates.length !== 1) {
        throw new Error(`Expected 1 active template, found ${activeTemplates.length}`);
      }
      this.log('Confirmed exclusive template activation');
    });

    // Test 9: Error Handling - Delete Active Template
    await this.test('Cannot Delete Active Template', async () => {
      const templateId = this.createdTemplateIds[0]; // Currently active
      try {
        await this.client.deleteTemplate(templateId);
        throw new Error('Should not be able to delete active template');
      } catch (error) {
        if (!error.message.includes('active template')) {
          throw new Error(`Wrong error message: ${error.message}`);
        }
        this.log('Correctly prevented deletion of active template');
      }
    });

    // Test 10: Error Handling - Duplicate Template Name
    await this.test('Cannot Create Duplicate Template Name', async () => {
      try {
        await this.client.createTemplate('Default', null, false);
        throw new Error('Should not be able to create duplicate template name');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw new Error(`Wrong error message: ${error.message}`);
        }
        this.log('Correctly prevented duplicate template name');
      }
    });

    // Test 11: Switch Back to Default
    await this.test('Switch Back to Default Template', async () => {
      const templates = await this.client.getTemplates();
      const defaultTemplate = templates.find(t => t.name === 'Default');
      
      const result = await this.client.setActiveTemplate(defaultTemplate.id);
      if (!result.success) throw new Error('Failed to switch back to Default');
      
      // Verify
      const activeTemplate = await this.client.getActiveTemplate();
      if (activeTemplate.name !== 'Default') {
        throw new Error('Failed to activate Default template');
      }
      this.log('Successfully switched back to Default template');
    });

    // Test 12: Delete Non-Active Templates
    await this.test('Delete Created Templates', async () => {
      for (const templateId of this.createdTemplateIds) {
        const result = await this.client.deleteTemplate(templateId);
        if (!result.success) throw new Error(`Failed to delete template ${templateId}`);
        this.log(`Successfully deleted template ID: ${templateId}`);
      }
    });

    // Test 13: Verify Cleanup
    await this.test('Verify Template Cleanup', async () => {
      const templates = await this.client.getTemplates();
      if (templates.length !== 1) {
        throw new Error(`Expected 1 template after cleanup, found ${templates.length}`);
      }
      if (templates[0].name !== 'Default') {
        throw new Error('Default template should be the only remaining template');
      }
      this.log('Successfully cleaned up test templates');
    });

    // Test 14: Error Handling - Cannot Delete Last Template
    await this.test('Cannot Delete Last Template', async () => {
      const templates = await this.client.getTemplates();
      const defaultTemplate = templates[0];
      
      try {
        await this.client.deleteTemplate(defaultTemplate.id);
        throw new Error('Should not be able to delete the last template');
      } catch (error) {
        if (!error.message.includes('last template')) {
          throw new Error(`Wrong error message: ${error.message}`);
        }
        this.log('Correctly prevented deletion of last template');
      }
    });

    // Print Results Summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`\n✅ PASSED: ${passed}/${total}`);
    console.log(`❌ FAILED: ${failed}/${total}`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(test => {
          console.log(`   • ${test.description}: ${test.error}`);
        });
    }

    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Step 2B Backend API Foundation is working correctly.');
      console.log('\n📋 Tested Features:');
      console.log('   ✅ Template listing and retrieval');
      console.log('   ✅ Template creation (empty and copied)');
      console.log('   ✅ Template activation and switching');
      console.log('   ✅ Template deletion with safety constraints');
      console.log('   ✅ Error handling and validation');
      console.log('   ✅ Business rule enforcement');
      console.log('\n🚀 Ready for Step 2C - Terminal Interface Updates!');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review the API implementation.`);
    }
  }
}

// Main execution
async function main() {
  const testSuite = new Step2BTestSuite();
  
  try {
    await testSuite.runAllTests();
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
    console.error('Make sure the server is running: npm run dev');
    process.exit(1);
  }
}

// Check if server is running before starting tests
fetch('http://localhost:3000/health')
  .then(() => main())
  .catch(() => {
    console.error('❌ Server not running! Please start with: npm run dev');
    process.exit(1);
  });