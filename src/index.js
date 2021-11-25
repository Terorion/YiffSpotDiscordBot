const Discord = require('discord.js'),
    betterSqlite3 = require('better-sqlite3'),
	path = require("path"),
    yiffspotjs = require('yiffspot.js');

require('dotenv').config({ path: path.join(__dirname, "../.env") });

const db = betterSqlite3(path.join(__dirname, "../db.sqlite")),
	config = require("../config.json");

db.exec(`
CREATE TABLE IF NOT EXISTS user_preference (
    id LONGTEXT PRIMARY KEY,
    gender LONGTEXT,
    specie LONGTEXT,
    kinks LONGTEXT,
    role LONGTEXT,
    partnerRole LONGTEXT,
    partnerGender LONGTEXT,
    partnerSpecie LONGTEXT,
    matchWithPreference BOOLEAN CHECK (matchWithPreference IN (0, 1))
    )
`);

function arrayEquals(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

function updateUserData(id, gender, specie, kinks, role, partnerRole, partnerGender, partnerSpecie, matchWithPreference) {
    if (id == null) return;
    const previousData = getUserData(id);
    if (gender == null) gender = previousData.gender;
    if (specie == null) specie = previousData.specie;
    if (kinks == null) kinks = previousData.kinks;
    (() => {
        if (Array.isArray(kinks)) kinks = (kinks.includes("any") || arrayEquals(kinks, yiffspotjs.Kink.filter(kink => kink != "any"))) && "any" || kinks.join(",");
        else {
            kinks = kinks.split(",").map(kink => kink.trim());
            if (kinks.includes("any") || arrayEquals(kinks, yiffspotjs.Kink.filter(kink => kink != "any"))) kinks = "any";
        }
    })();
    if (role == null) role = previousData.role;
    if (partnerRole == null) partnerRole = previousData.partnerRole;
    if (partnerGender == null) partnerGender = previousData.partnerGender;
    (() => {
        if (Array.isArray(partnerGender)) partnerGender = (partnerGender.includes("any") || arrayEquals(partnerGender, yiffspotjs.Gender.filter(gender => gender != "any"))) && "any" || partnerGender.join(",");
        else {
            partnerGender = partnerGender.split(",").map(gender => gender.trim());
            if (partnerGender.includes("any") || arrayEquals(partnerGender, yiffspotjs.Gender.filter(gender => gender != "any"))) partnerGender = "any";
        }
    })();
    if (partnerSpecie == null) partnerSpecie = previousData.partnerSpecie;
    (() => {
        if (Array.isArray(partnerSpecie)) partnerSpecie = (partnerSpecie.includes("any") || arrayEquals(partnerSpecie, yiffspotjs.Specie.filter(specie => specie != "any"))) && "any" || partnerSpecie.join(",");
        else {
            partnerSpecie = partnerSpecie.split(",").map(specie => specie.trim());
            if (partnerSpecie.includes("any") || arrayEquals(partnerSpecie, yiffspotjs.Specie.filter(specie => specie != "any"))) partnerSpecie = "any";
        }
    })();
    if (matchWithPreference == null) matchWithPreference = previousData.matchWithPreference;
    db.prepare(`
    INSERT INTO user_preference (id, gender, specie, kinks, role, partnerRole, partnerGender, partnerSpecie, matchWithPreference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    gender=excluded.gender,
    specie=excluded.specie,
    kinks=excluded.kinks,
    role=excluded.role,
    partnerRole=excluded.partnerRole,
    partnerGender=excluded.partnerGender,
    partnerSpecie=excluded.partnerSpecie,
    matchWithPreference=excluded.matchWithPreference
    `).run(id, gender, specie, kinks, role, partnerRole, partnerGender, partnerSpecie, matchWithPreference && 1 || 0);
}

function getUserData(id) {
    let data = db.prepare("SELECT * FROM user_preference WHERE id=?").all(id)[0];
    if (!data) {
        data = {};
        data.dataExist = false;
        data.randomized = true;
    } else {
        data.dataExist = true;
    }
    if (data.gender == null) {
        data.gender = yiffspotjs.randomGender(true);
        data.randomized = true;
    }
    if (data.specie == null) {
        data.specie = yiffspotjs.randomSpecie(true);
        data.randomized = true;
    }
    if (data.kinks == null) {
        data.kinks = yiffspotjs.Kink;
        data.randomized = true;
    }
    else {
        if (!Array.isArray(data.kinks)) data.kinks = data.kinks.split(",");
        if (data.kinks.includes("any")) data.kinks = ["any"];
    }
    if (data.role == null) {
        data.role = "Switch";
        data.randomized = true;
    }
    if (data.partnerRole == null) {
        data.partnerRole = "Switch";
        data.randomized = true;
    }
    if (data.partnerGender == null) {
        data.partnerGender = yiffspotjs.Gender;
        data.randomized = true;
    }
    else {
        if (!Array.isArray(data.partnerGender)) data.partnerGender = data.partnerGender.split(",");
        if (data.partnerGender.includes("any")) data.partnerGender = ["any"];
    }
    if (data.partnerSpecie == null) {
        data.partnerSpecie = yiffspotjs.Specie;
        data.randomized = true;
    }
    else {
        if (!Array.isArray(data.partnerSpecie)) data.partnerSpecie = data.partnerSpecie.split(",");
        if (data.partnerSpecie.includes("any")) data.partnerSpecie = ["any"];
    }
    if (data.matchWithPreference == null) {
        data.matchWithPreference = true;
        data.randomized = true;
    }
    else data.matchWithPreference = data.matchWithPreference == 1;
    return data;
}

(async () => {
    const discordClient = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MESSAGE_TYPING, Discord.Intents.FLAGS.GUILD_PRESENCES, Discord.Intents.FLAGS.GUILD_MEMBERS] });

	let discordPrefixEnabled = config.discordPrefixEnabled;
    let autosearch = config.autosearch;
    let readyBefore = false;

    discordClient.on('ready', async () => {
        let nameCollection = new Discord.Collection();
        let idArray = [];

        const partnerPerference = config.defaultPartnerPerference;
        const defaultPerference = config.defaultPerference;
        const discordUsernamPrefix = config.discordUsernamPrefix;
        const partnerTextPrefix = config.partnerTextPrefix;
        const prefix = config.prefix;

        let discordTypingTimeout;

        const webhook = new Discord.WebhookClient({
            id: config.webhook.id,
            token: config.webhook.token
        });

        const guild = await discordClient.guilds.fetch(config.guildID);
        const channel = await guild.channels.fetch(config.channelID);

        let yiffSpotClient

        function newPartner(userID) {
            if (!yiffSpotClient) return;
            readyBefore = true;
            nameCollection = new Discord.Collection();
            idArray = [];
            const data = getUserData(userID);
            yiffSpotClient.clientOptions.kinks = (data.dataExist && data.matchWithPreference && data.kinks) || defaultPerference.kinks;
            yiffSpotClient.clientOptions.specie = (data.dataExist && data.matchWithPreference && data.specie) || defaultPerference.specie;
            yiffSpotClient.clientOptions.role = (data.dataExist && data.matchWithPreference && data.role) || defaultPerference.role;
            yiffSpotClient.clientOptions.gender = (data.dataExist && data.matchWithPreference && data.gender) || defaultPerference.gender;
            yiffSpotClient.findPartner({
                "specie": data.dataExist && data.matchWithPreference && data.partnerSpecie || partnerPerference.specie,
                "role": data.dataExist && data.matchWithPreference && data.partnerRole || partnerPerference.role,
                "gender": data.dataExist && data.matchWithPreference && data.partnerGender || partnerPerference.gender
            });
        }

        function createInstance() {
            yiffSpotClient = new yiffspotjs.Client(defaultPerference);
            yiffSpotClient.on("waitingForPartner", async () => {
                webhook.send('We are looking for a partner to match you with.\nPlease either continue to wait, or modify your yiffing preferences.');
            });

            yiffSpotClient.on("ready", async () => {
                if (!readyBefore && autosearch) newPartner();
                readyBefore = true;
            });

            yiffSpotClient.on("partnerStartTyping", async () => {
                channel.sendTyping();
            });

            yiffSpotClient.on("message", async (message) => {
                message.text = message.text.replace(new RegExp(`@((everyone)|(here))`, "gi"), "@\u200b$1");
                if (nameCollection.size > 0) {
                    const matches = message.text.match(new RegExp(`@(${nameCollection.map(name => `(${discordUsernamPrefix}${name})`).join("|")})`, "gi"));
                    if (matches) {
                        for (let mention of matches.values()) {
                            if (mention.split(" ").length < 3) break;
                            const user = mention.split(" ")[2];
                            if (!idArray[user - 1]) break;
                            message.text = message.text.replace(`@${discordUsernamPrefix}${user}`, `<@${idArray[user - 1]}>`);
                        }
                    }
                }
                webhook.send(`${partnerTextPrefix}${message.text}`);
                console.log(`${partnerTextPrefix}${message.text}`);
            });

            yiffSpotClient.on("partnerConnected", async (partner) => {
                webhook.send(`You have been connected with a yiffing partner.\nYour partner is a ${partner.role}, ${partner.gender}, ${partner.specie} interested in: ${partner.kinks.join(", ")}`);
            });

            function handleLeave() {
                nameCollection = new Discord.Collection();
                idArray = [];
                clearTimeout(discordTypingTimeout);
                if (autosearch) newPartner();
            }

            yiffSpotClient.on("partnerLeft", async () => {
                webhook.send("Your yiffing partner has left.");
                handleLeave();
            });

            yiffSpotClient.on("partnerDisconnected", async () => {
                webhook.send("Your yiffing partner has disconnected unexpectedly.");
                handleLeave();
            });

            yiffSpotClient.on("raw", (msg) => {
                console.log(msg);
            });
        }

        createInstance();

        discordClient.on("messageCreate", async (message) => {
            if (message.author.id === discordClient.user.id || message.author.id === webhook.id) return;
            if (message.content === "") return;
            if (message.content.toLowerCase().startsWith(prefix)) {
                const args = message.content.slice(prefix.length).trim().split(/ +/g);
                const command = args.shift().toLowerCase();
                switch (command) {
                    case "newpartner": {
                        newPartner(message.author.id);
                        break;
                    }
                    case "disconnect": {
                        if (!yiffSpotClient.connected) return;
                        nameCollection = new Discord.Collection();
                        idArray = [];
                        yiffSpotClient.disconnect();
                        webhook.send("You've been disconnected.");
                        break;
                    }
                    case "connect": {
                        yiffSpotClient.connect();
                        webhook.send("Connected!");
                        break;
                    }
                    case "block": {
                        if (yiffSpotClient.connected) webhook.send('Your partner has been blocked and disconnected from you.');
                        else webhook.send("Your previous partner has been blocked.");
                        nameCollection = new Discord.Collection();
                        idArray = [];
                        yiffSpotClient.blockPartner();
                        if (autosearch) newPartner(message.author.id);
                        break;
                    }
                    case "setspecie": {
                        if (0 >= args.length || !yiffspotjs.Specie.filter(specie => specie != "any").includes(args.join(" ").trim())) return message.reply(`Valid species are ${yiffspotjs.Specie.filter(specie => specie != "any").map(specie => `**${specie}**`).join(", ")}`);
                        updateUserData(message.author.id, null, args.join(" ").trim());
                        message.reply(`Your specie have been updated to **${args.join(" ").trim()}**.`);
                        break;
                    }
                    case "setgender": {
                        if (0 >= args.length || !yiffspotjs.Gender.filter(specie => specie != "any").includes(args.join(" ").trim())) return message.reply(`Valid gender are ${yiffspotjs.Gender.filter(gender => gender != "any").map(gender => `**${gender}**`).join(", ")}`);
                        updateUserData(message.author.id, args.join(" ").trim());
                        message.reply(`Your gender have been updated to **${args.join(" ").trim()}**.`);
                        break;
                    }
                    case "setkinks": {
                        let kinks = args.join(" ").split(",").map(kink => kink.trim()).filter(kink => kink != "");;
                        if (0 >= args.length || kinks.some(kink => !yiffspotjs.Kink.includes(kink))) return message.reply(`Valid kinks are ${yiffspotjs.Kink.map(kink => `**${kink}**`).join(", ")}\nSeperate each kink by \`,\``);
                        if (kinks.includes("any") || arrayEquals(kinks, yiffspotjs.Gender.filter(gender => gender != "any"))) kinks = ["any"];
                        updateUserData(message.author.id, null, null, kinks.join(","));
                        message.reply(`Your kinks have been updated to ${kinks.map(kink => `**${kink}**`).join(", ")}.`);
                        break;
                    }
                    case "setrole": {
                        if (0 >= args.length || !yiffspotjs.Role.includes(args.join(" ").trim())) return message.reply(`Valid roles are ${yiffspotjs.Role.map(specie => `**${specie}**`).join(", ")}`);
                        updateUserData(message.author.id, null, null, null, args.join(" ").trim());
                        message.reply(`Your role have been updated to **${args.join(" ").trim()}**.`);
                        break;
                    }
                    case "togglematchwithpreference": {
                        let userData = getUserData(message.author.id);
                        updateUserData(message.author.id, null, null, null, null, null, null, null, !userData.matchWithPreference);
                        message.reply(`You ${!userData.matchWithPreference && "will" || "won't"} match with a partner based on your preference from now on.`);
                        break;
                    }
                    case "setpartnerrole": {
                        if (0 >= args.length || !yiffspotjs.Role.includes(args.join(" ").trim())) return message.reply(`Valid roles are ${yiffspotjs.Role.map(specie => `**${specie}**`).join(", ")}`);
                        updateUserData(message.author.id, null, null, null, null, args.join(" ").trim());
                        message.reply(`You will be matched with a **${args.join(" ").trim()}** partner from now on.`);
                        break;
                    }
                    case "setpartnergender": {
                        let genders = args.join(" ").split(",").map(gender => gender.trim()).filter(gender => gender != "");
                        if (0 >= args.length || genders.some(gender => !yiffspotjs.Gender.includes(gender))) return message.reply(`Valid genders are ${yiffspotjs.Gender.map(gender => `**${gender}**`).join(", ")}\nSeperate each gender by \`,\``);
                        if (genders.includes("any") || arrayEquals(genders, yiffspotjs.Gender.filter(gender => gender != "any"))) genders = ["any"];
                        updateUserData(message.author.id, null, null, null, null, null, genders.join(","));
                        message.reply(`You will be matched with a ${genders.map(gender => `**${gender}**`).join(", ")} partner from now on.`);
                        break;
                    }
                    case "setpartnerspecie": {
                        let species = args.join(" ").split(",").map(specie => specie.trim()).filter(specie => specie != "");
                        if (0 >= args.length || species.some(specie => !yiffspotjs.Specie.includes(specie))) return message.reply(`Valid species are ${yiffspotjs.Specie.map(specie => `**${specie}**`).join(", ")}\nSeperate each specie by \`,\``);
                        if (species.includes("any") || arrayEquals(species, yiffspotjs.Gender.filter(gender => gender != "any"))) species = ["any"];
                        updateUserData(message.author.id, null, null, null, null, null, null, species.join(","));
                        message.reply(`You will be matched with a ${species.map(specie => `**${specie}**`).join(", ")} from now on.`);
                        break;
                    }
                    case "removepreference": {
                        db.prepare("DELETE FROM user_preference WHERE id = ?").run(message.author.id);
                        message.reply("Your preference has been removed.");
                        break;
                    }
                    case "reset": {
                        if (yiffSpotClient) {
                            yiffSpotClient.removeAllListeners();
                            yiffSpotClient.disconnect();
                        }
                        if (discordTypingTimeout) {
                            clearTimeout(discordTypingTimeout);
                        }
                        createInstance();
                        message.reply("Instance resetted.");
                        break;
                    }
                    case "toggleautosearch": {
                        autosearch = !autosearch;
                        message.reply(`AutoSearch is now ${autosearch && "Enabled" || "Disabled"}`);
                        break;
                    }
                    case "togglediscordprefix": {
                        discordPrefixEnabled = !discordPrefixEnabled;
                        message.reply(`Discord Prefix is now ${discordPrefixEnabled && "Enabled" || "Disabled"}`);
                        break;
                    }
                    case "showpreference": {
                        const allOrDefault = (list, def) => {
                            if (Array.isArray(list) && list.includes("any")) return def;
                            else if (list.split(",").includes("any")) return def;
                            else return [list];
                        }

                        const data = db.prepare("SELECT * FROM user_preference WHERE id=?").all(message.author.id)[0];
                        if (!data) return message.reply("You didn't set any preference.");
                        const embed = new Discord.MessageEmbed()
                            .setTitle(`${message.author.tag}'s preference`)
                            .setColor(0x00AE86)
                            .setDescription(`Gender: ${data.gender || "null"}
Specie: ${data.specie || "null"}
Kinks: ${data.kinks && allOrDefault(data.kinks, ["Any/All"]).join(", ") || "null"}
Role: ${data.role || "null"}
Partner's Role: ${data.partnerRole || "null"}
Partner's Gender: ${data.partnerGender && allOrDefault(data.partnerGender, ["Any/All"]).join(", ") || "null"}
Partner's Specie: ${data.partnerSpecie && allOrDefault(data.partnerSpecie, ["Any/All"]).join(", ") || "null"}
Match With Perference: ${data.matchWithPreference && data.matchWithPreference == 1 && "Yes" || (data.matchWithPreference == null && "null" || 'No')}
                        `);
                        message.reply({ embeds: [embed] });
                        break;
                    }
                    case "help": {
                        const embed = new Discord.MessageEmbed()
                            .setTitle("YiffSpot Help")
                            .setColor(0x00AE86)
                            .setDescription(`${prefix}newpartner - Find a new partner
${prefix}disconnect - Disconnect from YiffSpot
${prefix}connect - Connect to YiffSpot
${prefix}block - Block Partner
${prefix}setspecie - Set your specie
${prefix}setgender - Set your gender
${prefix}setkinks - Set your kinks
${prefix}setpartnerrole - Set your partner role
${prefix}setpartnergender - Set your partner gender
${prefix}setpartnerspecie - Set your partner specie
${prefix}removepreference - Remove you preference from the database
${prefix}reset - Reset the bot if something goes wrong
${prefix}toggleautosearch - Toggle autosearch on/off
${prefix}togglematchwithpreference - Toggle Match With Perference on/off
${prefix}togglediscordprefix - Toggle if the "Discord User x" should appear on YiffSpot side on/off
${prefix}showpreference - Show your preference
                        `);
                        message.reply({ embeds: [embed] });
                        break;
                    }
                }
            } else if (yiffSpotClient.connected && message.channel.id == channel.id) {
                if (!nameCollection.get(message.author.id)) {
                    nameCollection.set(message.author.id, nameCollection.size + 1);
                    idArray[nameCollection.size - 1] = message.author.id;
                    const userData = getUserData(message.author.id);
                    if (discordPrefixEnabled) yiffSpotClient.sendMessage(`"${discordUsernamPrefix}${nameCollection.get(message.author.id)}" is a ${userData.dataExist && userData.role || "Unknown"}, ${userData.dataExist && userData.gender || "Unknown"}, ${userData.dataExist && userData.specie || "Unknown"} interested in: ${userData.dataExist && userData.kinks.join(", ") || "Unknown"}`);
                    webhook.send(`<@${message.author.id}> is now "${discordUsernamPrefix}${nameCollection.get(message.author.id)}"`);
                }
                message.mentions.members.forEach((user) => {
                    if (user.id != discordClient.user.id && !nameCollection.get(user.id)) {
                        nameCollection.set(user.id, nameCollection.size + 1);
                        idArray[nameCollection.size - 1] = user.id;
                        const userData = getUserData(user.id);
                        if (discordPrefixEnabled) yiffSpotClient.sendMessage(`"${discordUsernamPrefix}${nameCollection.get(user.id)}" is a ${userData.dataExist && userData.role || "Unknown"}, ${userData.dataExist && userData.gender || "Unknown"}, ${userData.specie} interested in: ${userData.dataExist && userData.kinks.join(", ") || "Unknown"}`);
                        webhook.send(`<@${user.id}> is now "${discordUsernamPrefix}${nameCollection.get(user.id)}"`);
                    }
                    const replacementText = `\"@${user.id == discordClient.user.id ? "Bot" : `${discordUsernamPrefix}${nameCollection.get(user.id)}`}\"`;
                    message.content = message.content.replace(new RegExp(`<@!?${user.id}>`, "gi"), replacementText);
                });
                message.mentions.channels.forEach((channel) => {
                    const replacementText = `"#${channel.name}"`;
                    message.content = message.content.replace(new RegExp(`<#${channel.id}>`, "gi"), replacementText);
                });
                message.mentions.roles.forEach((role) => {
                    const replacementText = `"@${role.name}"`;
                    message.content = message.content.replace(new RegExp(`<@&${role.id}>`, "gi"), replacementText);
                });
                if (yiffSpotClient.clientOptions.performTextCheck && yiffSpotClient.messageContainInvalidLink(message.content)) {
                    webhook.send(`<@${message.author.id}>, You have attempted to submit a possible malicious link.`);
                    return;
                }
                if (message.content == "" || yiffSpotClient.clientOptions.performTextCheck && yiffSpotClient.filterMessage(message.content) == "") {
                    webhook.send(`<@${message.author.id}>, Please enter a message.`);
                    return;
                }
                if (message.content.length > 3000 && !yiffSpotClient.clientOptions.performTextCheck || yiffSpotClient.filterMessage(message.content).length > 3000) {
                    webhook.send(`<@${message.author.id}>, Please shorten the length of your message.`);
                    return;
                }
                yiffSpotClient.sendMessage(`${discordPrefixEnabled && `${discordUsernamPrefix}${nameCollection.get(message.author.id)}: ` || ""}${yiffSpotClient.clientOptions.performTextCheck ? yiffSpotClient.filterMessage(message.content) : message.content}`);
                console.log(`${discordUsernamPrefix}${nameCollection.get(message.author.id)}: ${yiffSpotClient.clientOptions.performTextCheck ? yiffSpotClient.filterMessage(message.content) : message.content}`);
            }
        });

        discordClient.on("typingStart", async (typing) => {
            if (!yiffSpotClient) return;
            if (typing.channel.id !== channel.id) return;
            if (typing.user.id === discordClient.user.id) return;
            if (!yiffSpotClient.connected) return;
            yiffSpotClient.startTyping();
            if (discordTypingTimeout) clearTimeout(discordTypingTimeout);
            discordTypingTimeout = setTimeout(() => {
                yiffSpotClient.stopTyping();
            }, 10000);
        });
    });
    discordClient.login();
})();