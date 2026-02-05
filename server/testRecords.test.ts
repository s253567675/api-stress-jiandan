import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestRecord, getTestRecords, getTestRecordById, deleteTestRecord, updateTestRecordName } from './db';

describe('Test Records API', () => {
  let createdRecordId: number | null = null;

  const testRecordData = {
    name: 'Test Record - Unit Test',
    url: 'https://api.example.com/test',
    method: 'POST',
    config: { concurrency: 50, qps: 100 },
    status: 'completed' as const,
    totalRequests: 1000,
    successCount: 950,
    failCount: 50,
    avgLatency: 150,
    minLatency: 50,
    maxLatency: 500,
    p50Latency: 120,
    p90Latency: 250,
    p95Latency: 350,
    p99Latency: 450,
    throughput: 100,
    errorRate: 5.0,
    duration: 10,
    statusCodes: { 200: 950, 500: 50 },
    businessCodes: { '0': 900, '1001': 50 },
    timeSeries: [],
  };

  describe('createTestRecord', () => {
    it('should create a new test record and return its ID', async () => {
      const id = await createTestRecord(testRecordData);
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
      createdRecordId = id;
    });

    it('should create a record with all required fields', async () => {
      const minimalData = {
        name: 'Minimal Test Record',
        url: 'https://api.example.com/minimal',
        method: 'GET',
        status: 'completed' as const,
        totalRequests: 100,
        successCount: 100,
        failCount: 0,
        avgLatency: 100,
        minLatency: 50,
        maxLatency: 200,
        p50Latency: 90,
        p90Latency: 150,
        p95Latency: 180,
        p99Latency: 195,
        throughput: 50,
        errorRate: 0,
        duration: 2,
      };
      const id = await createTestRecord(minimalData);
      expect(id).toBeDefined();
      expect(id).toBeGreaterThan(0);
      
      // Clean up
      if (id) {
        await deleteTestRecord(id);
      }
    });
  });

  describe('getTestRecords', () => {
    it('should return an array of test records', async () => {
      const records = await getTestRecords(50);
      expect(Array.isArray(records)).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      const records = await getTestRecords(5);
      expect(records.length).toBeLessThanOrEqual(5);
    });

    it('should return records with expected properties', async () => {
      const records = await getTestRecords(10);
      if (records.length > 0) {
        const record = records[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
        expect(record).toHaveProperty('url');
        expect(record).toHaveProperty('method');
        expect(record).toHaveProperty('totalRequests');
        expect(record).toHaveProperty('successCount');
        expect(record).toHaveProperty('avgLatency');
        expect(record).toHaveProperty('createdAt');
      }
    });
  });

  describe('getTestRecordById', () => {
    it('should return a specific test record by ID', async () => {
      if (!createdRecordId) {
        console.log('Skipping test: no record created');
        return;
      }
      
      const record = await getTestRecordById(createdRecordId);
      expect(record).toBeDefined();
      expect(record?.id).toBe(createdRecordId);
      expect(record?.name).toBe(testRecordData.name);
      expect(record?.url).toBe(testRecordData.url);
    });

    it('should return null for non-existent ID', async () => {
      const record = await getTestRecordById(999999);
      expect(record).toBeNull();
    });
  });

  describe('updateTestRecordName', () => {
    it('should update the name of a test record', async () => {
      if (!createdRecordId) {
        console.log('Skipping test: no record created');
        return;
      }
      
      const newName = 'Updated Test Record Name';
      const success = await updateTestRecordName(createdRecordId, newName);
      expect(success).toBe(true);
      
      // Verify the update
      const record = await getTestRecordById(createdRecordId);
      expect(record?.name).toBe(newName);
    });

    it('should not throw error for non-existent ID', async () => {
      // The function returns true even for non-existent IDs because
      // the SQL UPDATE statement executes successfully (affecting 0 rows)
      const success = await updateTestRecordName(999999, 'New Name');
      expect(success).toBe(true);
    });
  });

  describe('deleteTestRecord', () => {
    it('should delete a test record', async () => {
      if (!createdRecordId) {
        console.log('Skipping test: no record created');
        return;
      }
      
      const success = await deleteTestRecord(createdRecordId);
      expect(success).toBe(true);
      
      // Verify deletion
      const record = await getTestRecordById(createdRecordId);
      expect(record).toBeNull();
      
      createdRecordId = null;
    });

    it('should not throw error for non-existent ID', async () => {
      // The function returns true even for non-existent IDs because
      // the SQL DELETE statement executes successfully (affecting 0 rows)
      const success = await deleteTestRecord(999999);
      expect(success).toBe(true);
    });
  });
});
