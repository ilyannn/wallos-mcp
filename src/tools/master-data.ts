import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WallosClient } from '../wallos-client.js';

export const getMasterDataTool: Tool = {
  name: 'get_master_data',
  description:
    'Retrieve all master data from Wallos including categories, currencies, payment methods, and household members',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export async function handleGetMasterData(wallosClient: WallosClient): Promise<string> {
  try {
    // eslint-disable-next-line no-console
    console.log('Fetching master data from Wallos API...');

    const masterData = await wallosClient.getMasterData();

    // Format the response for better readability
    const response = {
      summary: {
        categories_count: masterData.categories.length,
        currencies_count: masterData.currencies.items.length,
        payment_methods_count: masterData.payment_methods.length,
        household_members_count: masterData.household.length,
        main_currency_id: masterData.currencies.main_currency_id,
      },
      data: masterData,
    };

    // eslint-disable-next-line no-console
    console.log(
      `Successfully retrieved master data: ${response.summary.categories_count} categories, ${response.summary.currencies_count} currencies, ${response.summary.payment_methods_count} payment methods, ${response.summary.household_members_count} household members`,
    );

    return JSON.stringify(response, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // eslint-disable-next-line no-console
    console.error('Error fetching master data:', errorMessage);

    return JSON.stringify(
      {
        error: 'Failed to fetch master data',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}
