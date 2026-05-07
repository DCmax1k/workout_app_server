
//const creds = process.env.FOOD_API_CREDS || "off:off";
const creds = process.env.FOOD_API_CREDS || "digitalcaldwell:*jOb-4DtN-dC$g";


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
        const dataToStore = {
            name:  data.product.product_name, //product_name,_en_imported,
            quantity: parseFloat(data.product.serving_quantity) || 0,
            unit: data.product.serving_quantity_unit || 'unit',
            description: data.product.generic_name || "",
            image: data.selected_images?.front?.display?.["en"] || null,
        };
        const nutrition = {
            calories: (data.product.nutriments?.["energy-kcal_serving"] || 0) / dataToStore.quantity,
            protein: (data.product.nutriments?.proteins_serving || 0) / dataToStore.quantity,
            carbs: (data.product.nutriments?.carbohydrates_serving || 0) / dataToStore.quantity,
            fat: (data.product.nutriments?.fat_serving || 0) / dataToStore.quantity,
            
            // New nutrition values and vitamins/minerals
            fiber: (data.product.nutriments?.fiber_serving || 0) / dataToStore.quantity,
            sugar: (data.product.nutriments?.sugars_serving || 0) / dataToStore.quantity,
            sodium: (data.product.nutriments?.sodium_serving || 0) / dataToStore.quantity,
            vitaminA: (data.product.nutriments?.["vitamin-a_serving"] || 0) / dataToStore.quantity,
            vitaminC: (data.product.nutriments?.["vitamin-c_serving"] || 0) / dataToStore.quantity,
            calcium: (data.product.nutriments?.calcium_serving || 0) / dataToStore.quantity,
            iron: (data.product.nutriments?.iron_serving || 0) / dataToStore.quantity,
        };
        dataToStore.nutrition = nutrition;

        return dataToStore;
    } catch (error) {
        console.error("Error fetching food data from API:", error);
        throw error;
    }
};

module.exports = fetchFoodDataFromAPI;