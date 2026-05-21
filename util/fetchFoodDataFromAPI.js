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
        const rawNutriments = data.product?.nutriments;
        const statesTags = data.product?.states_tags || [];
        const isNutritionMissing = !rawNutriments || 
            Object.keys(rawNutriments).length === 0 || 
            statesTags.includes("en:nutrition-facts-to-be-completed");
        if (isNutritionMissing) {
            return { 
                status_verbose: "no_nutrition",
            };
        }
        
        const nutriments = data.product.nutriments || {};

        // 1. Detect best nutrition mode first so we can decide on the unit naming
        let nutritionMode = null;
        if (nutriments["energy-kcal_serving"] != null) {
            nutritionMode = "serving";
        } else if (nutriments["energy-kcal_prepared_serving"] != null) {
            nutritionMode = "prepared_serving";
        } else if (nutriments["energy-kcal_100g"] != null) {
            nutritionMode = "100g";
        } else if (nutriments["energy-kcal_prepared_100g"] != null) {
            nutritionMode = "prepared_100g";
        }

        // 2. Set default quantity to 1, and unit to "serving" or "unit"
        const dataToStore = {
            name: data.product.product_name,
            quantity: 1, 
            unit: (nutritionMode === "serving" || nutritionMode === "prepared_serving") ? "serving" : "unit",
            description: data.product.generic_name || "",
            image: data.product.selected_images?.front?.display?.["en"] || null,
        };

        // 3. Helper function returns the raw values for that 1 serving (or 1 unit of 100g)
        function getNutritionValue(baseKey) {
            switch (nutritionMode) {
                case "serving":
                    return nutriments[`${baseKey}_serving`] || 0;
                case "prepared_serving":
                    return nutriments[`${baseKey}_prepared_serving`] || 0;
                case "100g":
                    return nutriments[`${baseKey}_100g`] || 0;
                case "prepared_100g":
                    return nutriments[`${baseKey}_prepared_100g`] || 0;
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