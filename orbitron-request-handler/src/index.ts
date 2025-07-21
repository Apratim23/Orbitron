import express from 'express';
import { S3 } from 'aws-sdk';

// AWS S3 configuration
const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const app = express();

app.get("/*catchall", async (req, res) => {
    // Extract and FORCE lowercase of subdomain id
    const host = req.hostname;
    const id = host.split(".")[0].toLowerCase();

    // Normalize request path and decode
    let filePath = req.path;
    if (filePath.startsWith('/')) filePath = filePath.slice(1);
    filePath = decodeURIComponent(filePath);

    // S3 Key construction
    const key = `dist/${id}/${filePath}`;

    // Debug logging (remove/quiet down for production)
    console.log("Host:", host);
    console.log("ID (lowercase):", id);
    console.log("filePath:", filePath);
    console.log("Attempting S3 key:", key);

    try {
        const data = await s3.getObject({
            Bucket: "orbitron-deployment",
            Key: key
        }).promise();

        // Set suitable Content-Type
        let type = "application/octet-stream";
        if (filePath.endsWith(".html")) type = "text/html";
        else if (filePath.endsWith(".css")) type = "text/css";
        else if (filePath.endsWith(".js")) type = "application/javascript";
        else if (filePath.endsWith(".json")) type = "application/json";
        else if (filePath.endsWith(".svg")) type = "image/svg+xml";
        else if (filePath.endsWith(".ico")) type = "image/x-icon";

        res.setHeader("Content-Type", type);
        res.send(data.Body);
    } catch (e) {
        console.error("S3 fetch error:", e);
        res.status(404).send("Not found");
    }
});

app.listen(3001, () => {
    console.log("Request handler running on port 3001");
});
