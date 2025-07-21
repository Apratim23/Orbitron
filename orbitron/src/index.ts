import express from 'express';
import cors from "cors";
import simpleGit from 'simple-git';
import { generate } from "./utils";
import { getAllFiles } from './file';
import path from 'path';
import { uploadFile } from './aws';
import { createClient } from 'redis';

async function main() {
    // Create and connect Redis client
    const publisher = createClient({
        socket: {
            host: 'localhost',
            port: 6379 // Redis data port (NOT RedisInsight!)
        }
    });
    await publisher.connect();
    console.log("Connected to Redis");
   
    const app = express();
    app.use(cors());
    app.use(express.json());
    

    app.post("/deploy", async (req, res) => {
        try {
            console.log("Deploy endpoint called");
            const repoUrl = req.body.repoUrl;
            const id = generate().toLowerCase();
            const outputDir = path.join(__dirname, `output/${id}`);

            console.log(`Cloning repo: ${repoUrl}`);
            await simpleGit().clone(repoUrl, outputDir);

            console.log("Getting all files...");
            const files = getAllFiles(outputDir);
            console.log(`Found ${files.length} files.`);

            // Upload files sequentially for reliable debugging
            for (const file of files) {
                const s3Key = path.relative(path.join(__dirname), file).split(path.sep).join('/');
                console.log(`Uploading file: ${s3Key}`);
                await uploadFile(s3Key, file);
            }

            // Push to the build-queue (for worker/consumer) and confirm push
            const lpushResp = await publisher.lPush("build-queue", id);
            console.log("Pushed job to build-queue:", id, "response:", lpushResp);
            publisher.hSet("status",id,"uploaded");
            console.log("All files uploaded and job enqueued, responding with ID.");
            res.json({ id });
        } catch (err: any) {
            // Print error and send useful details to the client
            console.error("Error in /deploy:", err);
            res.status(500).json({
                error: "deploy failed",
                details: err?.message ?? err
            });
        }
    });

    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

     app.get("/status", async (req, res)=>{
                const id = (req.query.id as string)?.toLowerCase();
                const response = await publisher.hGet("status", id as string);
                res.json({
                    status: response || "unknown",
                })
            })
}

// Start everything and catch fatal errors
main().catch((err) => {
    console.error("Fatal server error:", err);
    process.exit(1);
});
