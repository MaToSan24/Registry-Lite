import mongoose from 'mongoose';

const agreementSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    version: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    context: {
        type: {
            validity: {
                type: {
                    initial: {
                        type: String
                    },
                    timeZone: {
                        type: String
                    },
                    end: {
                        type: String
                    }
                }
            },
            definitions: {
                type: {
                    scopes: {}
                }
            }
        }
    },
    terms: {
        metrics: {},
        guarantees: [{
            id: String,
            description: String,
            scope: {},
            of: {
                scope: {},
                objective: String,
                with: {},
                window: {
                    type: String,
                    period: String,
                    initial: String,
                    end: String
                }
            }
        }]
    }
}, { minimize: false });

agreementSchema.index({ id: 1 });

export default mongoose.model('Agreement', agreementSchema);