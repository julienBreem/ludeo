export function createRound(order) {
  return {
    order,
    cake: { dessert: order.dessert, doughOk: null, shape: null, bake: null, glaze: null, toppings: [] },
    results: {},
  };
}
