const mongoose = require("mongoose");
const dns = require("dns").promises;

const connectDB = async () => {
    let uri = process.env.MONGO_URI;

    try {
        await mongoose.connect(uri);
        console.log("MongoDB Connected Successfully");
        return;
    } catch (error) {
        console.warn("Standard SRV connection attempt failed:", error.message);

        // Fallback: If querySrv fails (e.g. EBADRESP on macOS local DNS), convert +srv URI to direct seedlist
        if (uri && uri.includes("mongodb+srv://")) {
            try {
                console.log("Attempting DNS-over-HTTPS SRV fallback resolution...");
                const urlParts = uri.replace("mongodb+srv://", "").split("/");
                const credentialsAndHost = urlParts[0];
                const dbAndParams = urlParts[1] || "";
                const [credentials, host] = credentialsAndHost.split("@");

                const srvName = `_mongodb._tcp.${host}`;
                let addresses = [];

                try {
                    addresses = await dns.resolveSrv(srvName);
                } catch (e) {
                    console.log("Native DNS querySrv failed, fetching from HTTPS DNS API...");
                    const res = await fetch(`https://dns.google/resolve?name=${srvName}&type=SRV`);
                    const json = await res.json();
                    if (json.Answer && json.Answer.length > 0) {
                        addresses = json.Answer.map(ans => {
                            const parts = ans.data.trim().split(/\s+/);
                            // Format of SRV answer data: priority weight port target
                            const port = parts[2] || "27017";
                            const target = parts[3] ? parts[3].replace(/\.$/, "") : host;
                            return { name: target, port: parseInt(port, 10) };
                        });
                    }
                }

                if (addresses && addresses.length > 0) {
                    const hosts = addresses.map(addr => `${addr.name}:${addr.port}`).join(",");
                    const fallbackUri = `mongodb://${credentials}@${hosts}/${dbAndParams}${dbAndParams.includes("?") ? "&" : "?"}ssl=true&authSource=admin`;

                    console.log("Connecting using resolved fallback seedlist...");
                    await mongoose.connect(fallbackUri);
                    console.log("MongoDB Connected Successfully via Fallback Seedlist!");
                    return;
                }
            } catch (fallbackErr) {
                console.error("Fallback SRV resolution error:", fallbackErr.message);
            }
        }

        process.exit(1);
    }
};

module.exports = connectDB;