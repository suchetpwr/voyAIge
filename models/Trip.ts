import mongoose from 'mongoose';

const DayPlan = new mongoose.Schema(
  {
    date: { type: String },
    summary: { type: String },
    activities: [
      {
        time: String,
        title: {type: String, required: true},
        location: String,
        address: String,
        estCost: Number,
        notes: String,
        bookingLink: String
      }
    ]
  },
  {_id: false}
);

const TripSchema = new mongoose.Schema(
  {
    destination: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    travelers: { type: Number, required: true },
    preferences: [String],
    budgetLevel: { type: String, enum: ["low", "mid", "high"] },
    notes: { type: String },
    tags: { type: [String] },
    itinerary: [DayPlan],
  },
  { timestamps: true }
);


TripSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("endDate must be on or after startDate"));
  }
  next();
});
export default (mongoose.models.Trip || mongoose.model('Trip', TripSchema));
