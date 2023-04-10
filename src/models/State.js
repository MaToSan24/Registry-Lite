import mongoose from 'mongoose';

const stateSchema = new mongoose.Schema({
    stateType: {
        type: String,
        enum: ['metric', 'guarantee']
    },
    agreementId: String,
    id: String,
    period: {
        from: Date,
        to: Date,
    },
    scope: {
        class: String,
        project: String,
        member: String,
    },
    records: [{
        evidences: [],
        metrics: [],
    }],
    window: {
        type: {
            type: String,
            enum: ['static', 'dynamic']
        },
        period: String,
        from: Date,
        to: Date,
        timeZone: String,
    }
}, { minimize: false });

stateSchema.index({ agreementId: 1 });
stateSchema.index({ stateType: 1, agreementId: 1, "scope.project": 1, "scope.class": 1, "period.from": 1, "period.to": 1, id: 1 }, { name: "compound_state_index" });

export default mongoose.model('State', stateSchema);