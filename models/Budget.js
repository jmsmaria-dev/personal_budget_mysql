const mongoose = require('mongoose');

// Define the budget item schema with title, related value, and color
const budgetItemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    budget: {
        type: Number,
        required: [true, 'Budget value is required'],
        min: [0, 'Budget must be a positive number']
    },
    color: {
        type: String,
        required: [true, 'Color is required'],
        validate: {
            validator: function(v) {
                // Validate hexadecimal color format with at least 6 digits
                return /^#[0-9A-Fa-f]{6,8}$/.test(v);
            },
            message: 'Color must be in hexadecimal format with at least 6 digits (e.g., #ED4523)'
        },
        uppercase: true // Convert to uppercase for consistency
    }
});

// Create the Budget model
const Budget = mongoose.model('Budget', budgetItemSchema);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/personal-budget';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected successfully');
        
        // Clear existing data first
        await Budget.deleteMany({});
        console.log('Cleared existing budget data');
        
        // Initial budget data with title, budget value, and color (no hardcoded chart data)
        let newData = [
            { title: "Eat out", budget: 52, color: "#FF6B6B" },
            { title: "Rent", budget: 604, color: "#4ECDC4" },
            { title: "Grocery", budget: 156, color: "#45B7D1" },
            { title: "Utilities", budget: 174, color: "#96CEB4" },
            { title: "Transportation", budget: 104, color: "#FFEAA7" },
            { title: "Entertainment", budget: 87, color: "#DDA0DD" },
            { title: "Savings", budget: 139, color: "#98D8C8" },
            { title: "Healthcare", budget: 70, color: "#F7DC6F" },
            { title: "Education", budget: 114, color: "#BB8FCE" }
        ];
        
        // Insert fresh data into MongoDB
        Budget.insertMany(newData)
            .then((data) => {
                console.log(`Inserted ${data.length} fresh budget items in MongoDB`);
            })
            .catch((error) => {
                console.log('Error inserting budget data:', error);
            });
    })
    .catch((connectionError) => {
        console.log('MongoDB connection error:', connectionError);
    });

module.exports = Budget;