import { Schema, Types, model } from 'mongoose';

const fcmTokenSchema = new Schema({
    fcmTokens: {
        type: [String],
    },
    Active:{
        type: Boolean,
        default: true
    }
},
    { timestamps: true }
)

export const fcmTokenModel = model('fcmTokens', fcmTokenSchema)