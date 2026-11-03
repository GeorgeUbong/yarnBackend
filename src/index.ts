import 'dotenv/config';
import express, { Request, Response } from "express";
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { pathToFileURL } from 'node:url';

export const app = express();
const PORT = process.env.PORT || 3000;

const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const developmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];
const allowedOrigins = new Set([...configuredOrigins, ...developmentOrigins]);

if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one trusted frontend origin in production');
}

const corsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true,
    maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


//Swagger docs
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'My API', version: '1.1.0' },
        tags: [
            { name: 'Auth', description: 'Authentication and token management' },
            { name: 'Users', description: 'User profile operations' },
        ],
        components: {
            securitySchemes: {
                accessCookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token',
                    description: 'HttpOnly access-token cookie (expires in 4 hours).',
                },
                refreshCookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'refreshToken',
                    description: 'HttpOnly refresh-token cookie (expires in 10 days).',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        username: { type: 'string', example: 'snapuser' },
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        profileImage: {
                            type: 'string',
                            nullable: true,
                            description: 'Base64 data URI for the profile image, or null when no image is set.',
                            example: 'data:image/png;base64,iVBORw0KGgo...',
                        },
                    },
                },
                Post: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'cm123abc00001xyz' },
                        authorId: { type: 'integer', example: 1 },
                        content: { type: 'string', example: 'My first post' },
                        postedAt: { type: 'string', format: 'date-time' },
                    },
                },
                PostWithAuthor: {
                    allOf: [
                        { $ref: '#/components/schemas/Post' },
                        {
                            type: 'object',
                            properties: {
                                author: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        username: { type: 'string', example: 'snapuser' },
                                    },
                                },
                            },
                        },
                    ],
                },
                Message: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
                MessageError: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: { type: 'string' },
                    },
                },
                ValidationError: {
                    type: 'object',
                    required: ['errors'],
                    properties: {
                        errors: {
                            type: 'object',
                            description: 'Zod field errors keyed by request field; each value is an array of validation messages.',
                            additionalProperties: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                            example: {
                                email: ['Invalid email address'],
                                password: ['Password must be at least 8 characters'],
                            },
                        },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);

//Expose routes in entry file
app.use("/api/v1/", authRoutes);
app.use("/api/v1/", userRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "the app is healthy "
    });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    app.listen(PORT, () => {
        console.log(`server runing now on port ${PORT}`)
    });
}
