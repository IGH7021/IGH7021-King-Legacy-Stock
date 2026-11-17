(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GAME_PASS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const METHODS = ["gift", "trade"];

  function isVariant(value) {
    return value !== null
      && typeof value === "object"
      && !Array.isArray(value)
      && Number.isFinite(value.price)
      && value.price >= 0
      && (value.stock === null || (Number.isSafeInteger(value.stock) && value.stock >= 0))
      && Number.isSafeInteger(value.sold)
      && value.sold >= 0;
  }

  function isValid(value) {
    return value !== null
      && typeof value === "object"
      && !Array.isArray(value)
      && METHODS.every(method => isVariant(value[method]));
  }

  function migrateLegacyProduct(product) {
    const price = Number(product.unitsPerBaht) > 0 ? 1 / Number(product.unitsPerBaht) : 0;
    const legacyStock = Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
    const soldValue = Number(product.sold);
    const legacySold = Number.isFinite(soldValue) && soldValue >= 0 ? Math.ceil(soldValue) : 0;
    return {
      gift: { price, stock: legacyStock, sold: legacySold },
      trade: { price, stock: 0, sold: 0 },
    };
  }

  function remaining(product, method) {
    const variant = product?.gamePass?.[method];
    if (!variant) return 0;
    if (variant.stock === null) return Infinity;
    return Math.max(0, variant.stock - variant.sold);
  }

  return { METHODS, isValid, migrateLegacyProduct, remaining };
});
