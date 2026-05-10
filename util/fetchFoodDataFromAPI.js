
const creds = process.env.FOOD_API_CREDS || "off:off";



const fetchFoodDataFromAPI = async (barcode) => {
    try {
        const url = `https://world.openfoodfacts.${creds === "off:off" ? "net" : "org"}/api/v2/product/${barcode}.json`;
        console.log("Fetching food data from API for barcode: " + barcode);
        console.log("Using URL: " + url);
        const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: "Basic " + btoa(creds) },
        });
        const data = await response.json();
        if (data.status_verbose === "product not found") {
            return data;
        }
        const nutriments = data.product.nutriments || {};

        const dataToStore = {
            name: data.product.product_name,
            quantity: parseFloat(data.product.serving_quantity) || 0,
            unit: data.product.serving_quantity_unit || "unit",
            description: data.product.generic_name || "",
            image: data.product.selected_images?.front?.display?.["en"] || null,
        };
        // Detect best nutrition mode
        let nutritionMode = null;
        // Priority:
        // 1. serving
        // 2. prepared_serving
        // 3. 100g
        // 4. prepared_100g
        if (nutriments["energy-kcal_serving"] != null) {
            nutritionMode = "serving";
        }
        else if (nutriments["energy-kcal_prepared_serving"] != null) nutritionMode = "prepared_serving";
        else if (nutriments["energy-kcal_100g"] != null) nutritionMode = "100g";
        else if (nutriments["energy-kcal_prepared_100g"] != null) nutritionMode = "prepared_100g";
        // Fallback quantities for 100g modes
        if (
            (nutritionMode === "100g" || nutritionMode === "prepared_100g") &&
            (!dataToStore.quantity || dataToStore.quantity <= 0)
        ) {
            dataToStore.quantity = 10;
            dataToStore.unit = "g";
        }
        // Helper function
        function getNutritionValue(baseKey) {
            let value = 0;
            switch (nutritionMode) {
                case "serving":
                    value = nutriments[`${baseKey}_serving`] || 0;
                    // convert serving -> per 1 unit
                    return dataToStore.quantity > 0 ? value / dataToStore.quantity : value;
                case "prepared_serving":
                    value = nutriments[`${baseKey}_prepared_serving`] || 0;
                    // convert serving -> per 1 unit
                    return dataToStore.quantity > 0 ? value / dataToStore.quantity : value;
                case "100g":
                    value = nutriments[`${baseKey}_100g`] || 0;
                    // convert per100g -> per1g
                    return value / 100;
                case "prepared_100g":
                    value = nutriments[`${baseKey}_prepared_100g`] || 0;
                    // convert per100g -> per1g
                    return value / 100;
                default:
                    return 0;
            }
        }

        const nutrition = {
            calories: getNutritionValue("energy-kcal"),
            protein: getNutritionValue("proteins"),
            carbs: getNutritionValue("carbohydrates"),
            fat: getNutritionValue("fat"),

            // New nutrition values and vitamins/minerals
            fiber: getNutritionValue("fiber"),
            sugar: getNutritionValue("sugars"),
            sodium: getNutritionValue("sodium"),
            vitaminA: getNutritionValue("vitamin-a"),
            vitaminC: getNutritionValue("vitamin-c"),
            calcium: getNutritionValue("calcium"),
            iron: getNutritionValue("iron"),
        };

        dataToStore.nutrition = nutrition;

        return dataToStore;
    } catch (error) {
        console.error("Error fetching food data from API:", error);
        throw error;
    }
};

module.exports = fetchFoodDataFromAPI;