module.exports.config = {
    name: "gali",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Sami",
    description: "Random slang and gali command",
    commandCategory: "fun",
    usages: "[tag]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const slangs = [
        "খানকিরপোলা তোর মাইরা চুদি!",
        "মাগিবাজি বন্ধ কর হালায়, সারাদিন ফালতু চুদুরবুদুর ভাল্লাগে না।",
        "বালছাল কতা কস কেন সারাদিন? মাথা গরম কইরা দিস না তো!",
        "মাদারবোদ, ফাউ কথা কওয়া বন্ধ না করলে কিক খাবি!",
        "তোর গুষ্টির পিন্ডি চুদাই হালায়, বাল পাকনামি কম কর!",
        "চুদাচুদি বন্ধ কইরা সোজা লাইনে আয়, নাইলে ব্লক খাবি ফালতু!",
        "মায়ের লগে শুইয়া বড় হইছিস নাকি রে হালায়? ফাও বকিস না তো!",
        "তোর চোদ্দগোষ্ঠী তুইলা গালি দিমু নাকি রে বাল?",
        "সারাদিন তো দেখি শুধু চুদাচুদি নিয়া মাথা ঘামাস, আক্কেলহীন খানকিরপোলা!",
        "তোর মগজটা গোবর দিয়া ভরপুর, বালছাল কতা বইলো না তো সামনে আইসা!"
    ];

    const randomSlang = slangs[Math.floor(Math.random() * slangs.length)];

    if (Object.keys(event.mentions).length > 0) {
        const taggedID = Object.keys(event.mentions)[0];
        const name = event.mentions[taggedID].replace("@", "");
        return api.sendMessage({
            body: `@${name} ${randomSlang}`,
            mentions: [{ tag: `@${name}`, id: taggedID }]
        }, event.threadID, event.messageID);
    } else {
        return api.sendMessage(randomSlang, event.threadID, event.messageID);
    }
};
