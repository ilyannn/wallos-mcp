/**
 * Unit tests for category CRUD tools
 * Tests add, update, and delete operations for categories
 */

import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import {
  addCategoryTool,
  updateCategoryTool,
  deleteCategoryTool,
  handleAddCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from '../src/tools/categories.js';

describe('Category Tools', () => {
  let mockClient: any;
  let stderrSpy: any;

  beforeEach(() => {
    // Create a mock client
    mockClient = {
      addCategory: mock(),
      updateCategory: mock(),
      deleteCategory: mock(),
    };

    // Mock process.stderr.write
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  describe('Tool Definitions', () => {
    test('addCategoryTool should have correct definition', () => {
      expect(addCategoryTool.name).toBe('add_category');
      expect(addCategoryTool.description).toContain('Add a new category');
      expect(addCategoryTool.inputSchema.properties).toHaveProperty('name');
      expect(addCategoryTool.inputSchema.additionalProperties).toBe(false);
    });

    test('updateCategoryTool should have correct definition', () => {
      expect(updateCategoryTool.name).toBe('update_category');
      expect(updateCategoryTool.description).toContain('Update an existing category');
      expect(updateCategoryTool.inputSchema.properties).toHaveProperty('id');
      expect(updateCategoryTool.inputSchema.properties).toHaveProperty('name');
      expect(updateCategoryTool.inputSchema.required).toEqual(['id', 'name']);
    });

    test('deleteCategoryTool should have correct definition', () => {
      expect(deleteCategoryTool.name).toBe('delete_category');
      expect(deleteCategoryTool.description).toContain('Delete a category');
      expect(deleteCategoryTool.inputSchema.properties).toHaveProperty('id');
      expect(deleteCategoryTool.inputSchema.required).toEqual(['id']);
    });
  });

  describe('handleAddCategory', () => {
    test('should add category successfully without name', async () => {
      const mockResponse = {
        success: true,
        categoryId: 5,
      };
      mockClient.addCategory.mockResolvedValue(mockResponse);

      const result = await handleAddCategory(mockClient, {});

      expect(mockClient.addCategory).toHaveBeenCalledWith(undefined);
      expect(stderrSpy).toHaveBeenCalledWith('Adding new category\n');
      expect(stderrSpy).toHaveBeenCalledWith('Successfully added category with ID: 5\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.categoryId).toBe(5);
    });

    test('should add category successfully with name', async () => {
      const mockResponse = {
        success: true,
        categoryId: 6,
      };
      mockClient.addCategory.mockResolvedValue(mockResponse);

      const result = await handleAddCategory(mockClient, { name: 'Entertainment' });

      expect(mockClient.addCategory).toHaveBeenCalledWith('Entertainment');
      expect(stderrSpy).toHaveBeenCalledWith('Adding new category: Entertainment\n');
      expect(stderrSpy).toHaveBeenCalledWith('Successfully added category with ID: 6\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.categoryId).toBe(6);
    });

    test('should handle add errors gracefully', async () => {
      const mockResponse = {
        success: false,
        errorMessage: 'Failed to add category',
      };
      mockClient.addCategory.mockResolvedValue(mockResponse);

      const result = await handleAddCategory(mockClient, { name: 'Test' });

      expect(stderrSpy).toHaveBeenCalledWith('Adding new category: Test\n');
      expect(stderrSpy).toHaveBeenCalledWith('Error adding category: Failed to add category\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to add category');
      expect(parsedResult.details).toBe('Failed to add category');
    });

    test('should handle network errors', async () => {
      mockClient.addCategory.mockRejectedValue(new Error('Network error'));

      const result = await handleAddCategory(mockClient, { name: 'Test' });

      expect(stderrSpy).toHaveBeenCalledWith('Error adding category: Network error\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to add category');
      expect(parsedResult.details).toBe('Network error');
    });
  });

  describe('handleUpdateCategory', () => {
    test('should update category successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Category saved',
      };
      mockClient.updateCategory.mockResolvedValue(mockResponse);

      const result = await handleUpdateCategory(mockClient, { id: 2, name: 'Updated Name' });

      expect(mockClient.updateCategory).toHaveBeenCalledWith(2, 'Updated Name');
      expect(stderrSpy).toHaveBeenCalledWith('Updating category 2 to: Updated Name\n');
      expect(stderrSpy).toHaveBeenCalledWith('Successfully updated category 2\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Category saved');
      expect(parsedResult.categoryId).toBe(2);
    });

    test('should prevent updating default category (ID 1)', async () => {
      const result = await handleUpdateCategory(mockClient, { id: 1, name: 'New Name' });

      expect(mockClient.updateCategory).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Error updating category: Cannot modify the default category (ID: 1)\n',
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to update category');
      expect(parsedResult.details).toContain('Cannot modify the default category');
    });

    test('should handle update errors gracefully', async () => {
      const mockResponse = {
        success: false,
        errorMessage: 'Category name already exists',
      };
      mockClient.updateCategory.mockResolvedValue(mockResponse);

      const result = await handleUpdateCategory(mockClient, { id: 3, name: 'Duplicate' });

      expect(stderrSpy).toHaveBeenCalledWith('Updating category 3 to: Duplicate\n');
      expect(stderrSpy).toHaveBeenCalledWith(
        'Error updating category: Category name already exists\n',
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to update category');
      expect(parsedResult.details).toBe('Category name already exists');
    });

    test('should handle network errors', async () => {
      mockClient.updateCategory.mockRejectedValue(new Error('Connection timeout'));

      const result = await handleUpdateCategory(mockClient, { id: 2, name: 'Test' });

      expect(stderrSpy).toHaveBeenCalledWith('Error updating category: Connection timeout\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to update category');
      expect(parsedResult.details).toBe('Connection timeout');
    });
  });

  describe('handleDeleteCategory', () => {
    test('should delete category successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Category removed',
      };
      mockClient.deleteCategory.mockResolvedValue(mockResponse);

      const result = await handleDeleteCategory(mockClient, { id: 3 });

      expect(mockClient.deleteCategory).toHaveBeenCalledWith(3);
      expect(stderrSpy).toHaveBeenCalledWith('Deleting category 3\n');
      expect(stderrSpy).toHaveBeenCalledWith('Successfully deleted category 3\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Category removed');
      expect(parsedResult.categoryId).toBe(3);
    });

    test('should prevent deleting default category (ID 1)', async () => {
      const result = await handleDeleteCategory(mockClient, { id: 1 });

      expect(mockClient.deleteCategory).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Error deleting category: Cannot delete the default category (ID: 1)\n',
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to delete category');
      expect(parsedResult.details).toContain('Cannot delete the default category');
    });

    test('should handle deletion of category in use', async () => {
      const mockResponse = {
        success: false,
        errorMessage: 'Category is in use by subscriptions',
      };
      mockClient.deleteCategory.mockResolvedValue(mockResponse);

      const result = await handleDeleteCategory(mockClient, { id: 2 });

      expect(stderrSpy).toHaveBeenCalledWith('Deleting category 2\n');
      expect(stderrSpy).toHaveBeenCalledWith(
        'Error deleting category: Category is in use by subscriptions\n',
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to delete category');
      expect(parsedResult.details).toBe('Category is in use by subscriptions');
    });

    test('should handle network errors', async () => {
      mockClient.deleteCategory.mockRejectedValue(new Error('Server unavailable'));

      const result = await handleDeleteCategory(mockClient, { id: 4 });

      expect(stderrSpy).toHaveBeenCalledWith('Error deleting category: Server unavailable\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to delete category');
      expect(parsedResult.details).toBe('Server unavailable');
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined error messages', async () => {
      const mockResponse = {
        success: false,
        // No errorMessage provided
      };
      mockClient.addCategory.mockResolvedValue(mockResponse);

      const result = await handleAddCategory(mockClient, {});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toBe('Failed to add category');
      expect(parsedResult.details).toBe('Failed to add category');
    });

    test('should handle non-Error thrown objects', async () => {
      mockClient.updateCategory.mockRejectedValue('String error');

      const result = await handleUpdateCategory(mockClient, { id: 2, name: 'Test' });

      expect(stderrSpy).toHaveBeenCalledWith('Error updating category: Unknown error occurred\n');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.details).toBe('Unknown error occurred');
    });

    test('should include timestamp in error responses', async () => {
      mockClient.addCategory.mockRejectedValue(new Error('Test error'));

      const result = await handleAddCategory(mockClient, {});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.timestamp).toBeDefined();
      expect(new Date(parsedResult.timestamp).toISOString()).toBe(parsedResult.timestamp);
    });
  });
});