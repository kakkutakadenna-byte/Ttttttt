// গ্লোবাল লুপ স্টোরেজ রাখার জন্য
global.galiSpamSessions = global.galiSpamSessions || {};

module.exports.config = {
    name: "gali",
    version: "4.0.0",
    hasPermssion: 0,
    author: "Sami",
    description: "Massive combined rhythmic and hardcore spam gali command",
    commandCategory: "fun",
    usages: "[tag / stop]",
    cooldowns: 5
};

module.exports.onStart = async function({ api, event, args }) {
    const threadID = event.threadID;
    const action = args[0];

    // যদি কেউ বন্ধ করতে চায়
    if (action === "stop" || action === "off") {
        if (global.galiSpamSessions[threadID]) {
            clearInterval(global.galiSpamSessions[threadID]);
            delete global.galiSpamSessions[threadID];
            return api.sendMessage("🛑 গালি স্প্যাম বন্ধ করা হয়েছে!", threadID, event.messageID);
        } else {
            return api.sendMessage("⚠️ এই গ্রুপে বর্তমানে কোনো গালি স্প্যাম চলছে না!", threadID, event.messageID);
        }
    }

    // কবিতার ছন্দ এবং হার্ডকোর স্লাং মিলিয়ে বিশাল লিস্ট
    const slangs = [
        "সকালে উঠে করিস ফাউ বকবক,\nতোর মগজে গোবর ভরা, তুই একটা অবালক!",
        "খানকিরপোলা তোর মাইরা চুদি আজ,\nসারাদিন শুধু করিস তুই ফাউ গবাদিপশুর কাজ!",
        "মাগিবাজি করিস কেন রাস্তাঘাটে বইয়া,\nতোর চৌদ্দগোষ্ঠী মুতে দিবো একসাথে গিয়া!",
        "বালছাল কতা কস তুই সারাবেলা,\nতোর কপালে আছে আজ কঠিন একটা খেলা!",
        "মাদারবোদ তুই ফাউ কথা কওয়া কর বন্ধ,\nনাহলে খাবি কিক, চোখে দেখবি সব অন্ধ!",
        "তোর গুষ্টির পিণ্ডি চুদাই বারে বারে,\nলজ্জা শরম নাই রে তোর, ঘাস খা গিয়ে বাছুরে!",
        "চুদাচুদি বাদ দিয়া সোজা লাইনে আয়,\nতোর মতো ছাগলরে দুনিয়ায় কেউ তো চায় না ভাই!",
        "মায়ের পেটে বড় হইলি ক্যামনে রে হালায়?\nআক্কেল তোর গোল্লায় গেছে, ঘাস কাটিস ডালায়!",
        "সারাদিন তো দেখি শুধু চুদাচুদি নিয়ে তোর মন,\nখানকিরপোলা দূর হয়ে যা, পচে গেছে তোর মন!",
        "তোর মগজটা ধুইয়া দিলেও পরিষ্কার হবে না,\nতোর মতো বেআক্কেল দুনিয়ায় আর একটাও রবে না!",
        "খানকিরপোলা তোর মাইরা চুদি!",
        "মাগিবাজি বন্ধ কর হালায়, সারাদিন ফালতু চুদুরবুদুর ভাল্লাগে না।",
        "বালছাল কতা কস কেন সারাদিন? মাথা গরম কইরা দিস না তো!",
        "মাদারবোদ, ফাউ কথা কওয়া বন্ধ না করলে কিক খাবি!",
        "তোর গুষ্টির পিন্ডি চুদাই হালায়, বাল পাকনামি কম কর!",
        "চুদাচুদি বন্ধ কইরা সোজা লাইনে আয়, নাইলে ব্লক খাবি ফালতু!",
        "মায়ের লগে শুইয়া বড় হইছিস নাকি রে হালায়? ফাও বকিস না তো!",
        "তোর চোদ্দগোষ্ঠী তুইলা গালি দিমু নাকি রে বাল?",
        "সারাদিন তো দেখি শুধু চুদাচুদি নিয়া মাথা ঘামাস, আক্কেলহীন খানকিরপোলা!",
        "তোর মগজটা গোবর দিয়া ভরপুর, বালছাল কতা বইলো না তো সামনে আইসা!",
        "মাদারচোদ কোথাকার, ফালতু চুদুরবুদুর একদম বন্ধ করবি!",
        "তোর গুষ্টির মাথায় মুতি হালায়, ফাও চুদাস না তো বেশি!",
        "চুদি তোর গুষ্টি শুদ্ধা, ভাল্লাগে না ফালতু ফাইজলামি!",
        "তোর বাপের নাম কি ভুইলা গেছোস নাকি রে খানকিরপোলা?",
        "শালা চুদির ভাই, সারাদিন খালি বাল পাকনামি করিস ক্যান?",
        "তোর চৌদ্দগোষ্ঠীর গুষ্টি চুদাই, ফাও বকবক বন্ধ কর!",
        "মাগীর পোলা মাগিবাজি করো কার লগে? আইসো না সামনে!",
        "বাল পাকনা হালায়, তোর মগজটা ধুইয়া মদ্যপান করায়া দিমু নাকি?",
        "খানকির পোলা তোর চোদাচুদি বন্ধ না করলে কিক খাইয়া পাবি বাইর হইয়া!",
        "তোর মাইয়া জাতের গুষ্টি তুলিয়া গালি দিমু একটা টান দিয়া!"
    ];

    // কেউ ট্যাগ করা আছে কিনা দেখা
    let targetID = null;
    let targetName = "";
    if (Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        targetName = event.mentions[targetID].replace("@", "");
    }

    if (global.galiSpamSessions[threadID]) {
        return api.sendMessage("⚠️ ইতিমধ্যে এই গ্রুপে স্প্যাম চলছে! বন্ধ করতে চাইলে লিখুন: `/gali stop`", threadID, event.messageID);
    }

    api.sendMessage("🚀 ছন্দ ও হার্ডকোর গালির আনলিমিটেড স্প্যাম শুরু হলো! বন্ধ করতে লিখুন: `/gali stop`", threadID);

    // প্রতি ১.৫ সেকেন্ড পর পর গালি পাঠানোর লুপ
    global.galiSpamSessions[threadID] = setInterval(() => {
        const randomSlang = slangs[Math.floor(Math.random() * slangs.length)];

        if (targetID && targetName) {
            api.sendMessage({
                body: `@${targetName}\n${randomSlang}`,
                mentions: [{ tag: `@${targetName}`, id: targetID }]
            }, threadID);
        } else {
            api.sendMessage(randomSlang, threadID);
        }
    }, 1500);
};
            
