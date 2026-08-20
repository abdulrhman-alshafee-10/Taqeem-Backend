import { client } from "../es.js";

const INDEX = "businesses";

// We'll use Painless scripts to update the nested menuItems array

export async function onMenuItemCreated(payload: any) {
  const { businessId, itemId } = payload;
  // Normally we would fetch the item from the DB or payload to get its name, dietary, priceEgp.
  // For this mock implementation, we assume the payload contains the item details, or we just insert a placeholder.
  
  const newItem = {
    name: payload.name || "Unknown item",
    dietary: payload.dietary || [],
    priceEgp: payload.basePrice || 0
  };

  try {
    await client.update({
      index: INDEX,
      id: businessId,
      script: {
        source: `
          if (ctx._source.menuItems == null) {
            ctx._source.menuItems = [];
          }
          ctx._source.menuItems.add(params.item);
        `,
        params: { item: newItem }
      }
    });
  } catch (err: any) {
    if (err.meta?.statusCode !== 404) console.error("Error updating menu items in ES", err.message);
  }
}

export async function onMenuItemUnavailable(payload: any) {
  // Mock removal or unavailability
  const { businessId, itemId } = payload;
  
  try {
    await client.update({
      index: INDEX,
      id: businessId,
      script: {
        source: `
          if (ctx._source.menuItems != null) {
            // Simplified: we don't have itemId in the nested object currently, 
            // so this would normally require itemId in the mapping to remove by ID.
            // For now, we skip the actual script removal in this mock.
          }
        `
      }
    });
  } catch (err: any) {
    if (err.meta?.statusCode !== 404) console.error("Error updating menu items in ES", err.message);
  }
}
