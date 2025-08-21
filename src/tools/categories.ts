import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WallosClient } from '../wallos-client.js';

export const addCategoryTool: Tool = {
  name: 'add_category',
  description: 'Add a new category to Wallos',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Category name (optional, defaults to "Category")',
      },
    },
    additionalProperties: false,
  },
};

export const updateCategoryTool: Tool = {
  name: 'update_category',
  description: 'Update an existing category name',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'Category ID to update',
      },
      name: {
        type: 'string',
        description: 'New category name',
      },
    },
    required: ['id', 'name'],
    additionalProperties: false,
  },
};

export const deleteCategoryTool: Tool = {
  name: 'delete_category',
  description: 'Delete a category (cannot delete default category ID 1 or categories in use)',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'Category ID to delete',
      },
    },
    required: ['id'],
    additionalProperties: false,
  },
};

export async function handleAddCategory(
  wallosClient: WallosClient,
  params: { name?: string },
): Promise<string> {
  try {
    process.stderr.write(`Adding new category${params.name ? `: ${params.name}` : ''}\n`);

    const result = await wallosClient.addCategory(params.name);

    if (result.success) {
      process.stderr.write(`Successfully added category with ID: ${result.categoryId}\n`);
      return JSON.stringify(
        {
          success: true,
          message: 'Category added successfully',
          categoryId: result.categoryId,
        },
        null,
        2,
      );
    } else {
      throw new Error(result.errorMessage || 'Failed to add category');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    process.stderr.write(`Error adding category: ${errorMessage}\n`);

    return JSON.stringify(
      {
        error: 'Failed to add category',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}

export async function handleUpdateCategory(
  wallosClient: WallosClient,
  params: { id: number; name: string },
): Promise<string> {
  try {
    // Validate against protected categories
    if (params.id === 1) {
      throw new Error('Cannot modify the default category (ID: 1)');
    }

    process.stderr.write(`Updating category ${params.id} to: ${params.name}\n`);

    const result = await wallosClient.updateCategory(params.id, params.name);

    if (result.success) {
      process.stderr.write(`Successfully updated category ${params.id}\n`);
      return JSON.stringify(
        {
          success: true,
          message: result.message || 'Category updated successfully',
          categoryId: params.id,
        },
        null,
        2,
      );
    } else {
      throw new Error(result.errorMessage || 'Failed to update category');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    process.stderr.write(`Error updating category: ${errorMessage}\n`);

    return JSON.stringify(
      {
        error: 'Failed to update category',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}

export async function handleDeleteCategory(
  wallosClient: WallosClient,
  params: { id: number },
): Promise<string> {
  try {
    // Validate against protected categories
    if (params.id === 1) {
      throw new Error('Cannot delete the default category (ID: 1)');
    }

    process.stderr.write(`Deleting category ${params.id}\n`);

    const result = await wallosClient.deleteCategory(params.id);

    if (result.success) {
      process.stderr.write(`Successfully deleted category ${params.id}\n`);
      return JSON.stringify(
        {
          success: true,
          message: result.message || 'Category deleted successfully',
          categoryId: params.id,
        },
        null,
        2,
      );
    } else {
      throw new Error(result.errorMessage || 'Failed to delete category');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    process.stderr.write(`Error deleting category: ${errorMessage}\n`);

    return JSON.stringify(
      {
        error: 'Failed to delete category',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}
