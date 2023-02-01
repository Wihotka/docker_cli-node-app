import os from "os";
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";
import inquirer from "inquirer";
import axios from "axios";
import Table from "cli-table";

dotenv.config();

const homeDir = os.homedir();
const isWindows = os.type().match(/windows/i);
const sessionFileName = path.join(homeDir, `${isWindows ? "_" : "."}sb-timers-session`);

const authForm = [
    {type: "input", name: "username", message: "Username: "},
    {type: "password", mask: "*", name: "password", message: "Password: "}
];
const timerName = [
    {type: "input", name: "description", message: "Enter timer's name: "}
];

const signupOrLogin = async (authForm) => {
    console.log();

    const userData = await inquirer.prompt(authForm);
    const res = await axios({
        method: "post",
        url: `${process.env.SERVER}/${process.argv[2]}`,
        headers: {},
        data: userData
    });

    if (res.data.error) console.log("\x1b[31m", `\n${res.data.error}\n`);
    else {
        fs.writeFile(sessionFileName, res.data.sessionId, err => {
            if (err) {
                console.log("\x1b[31m", err);
                return;
            }
            const isSignup = process.argv[2] === "signup";
            console.log("\x1b[32m", `\n${isSignup ? "Signed" : "Logged"} up successfully!\n`);
        });
    }
};

const logout = async () => {
    console.log();

    try {
        const sessionId = fs.readFileSync(sessionFileName, "utf-8");

        fs.unlink(sessionFileName, err => {
            if (err) console.log("\x1b[31m", err);
        });

        await axios.get(`${process.env.SERVER}/${process.argv[2]}`, {params: {sessionId}});

        console.log("\x1b[1m", "Goodbye!\n");
    } catch (err) {
        console.log("\x1b[31m", "Please login or signup!\n");
    }
};

const status = async () => {
    console.log();

    let timersTable = new Table({head: ["ID", "Timer", "Time"], colWidths: [30, 20, 15]});

    try {
        const sessionId = fs.readFileSync(sessionFileName, "utf-8");
        const res = await axios(`${process.env.SERVER}/api/timers`, {params: {sessionId}});

        const activeTimers = res.data.filter(timer => timer.isActive);

        if (!activeTimers.length) {
            console.log("\x1b[31m", "You have no active timers\n");
            return;
        }

        activeTimers.forEach(timer => {
            timersTable.push([timer._id, timer.description, formatDuration(timer.progress)]);
        });

        if (!process.argv[3]) {
            console.log(`${timersTable.toString()}\n`);
            return;
        }

        if (process.argv[3] === "old") {
            timersTable = new Table({head: ["ID", "Timer", "Time"], colWidths: [30, 20, 15]});

            const oldTimers = res.data.filter(timer => !timer.isActive);

            if (!oldTimers.length) {
                console.log("\x1b[31m", "You have no old timers\n");
                return;
            }

            oldTimers.forEach(timer => {
                timersTable.push([timer._id, timer.description, formatDuration(timer.progress)]);
            });

            console.log(`${timersTable.toString()}\n`);
        } else {
            timersTable = new Table({head: ["ID", "Timer", "Time"], colWidths: [30, 20, 15]});

            const [selectedTimer] = activeTimers.filter(timer => timer._id === process.argv[3]);

            if (!selectedTimer) {
                console.log("\x1b[31m", `Unknown timer ID ${process.argv[3]}\n`);
                return;
            }

            timersTable.push([selectedTimer._id, selectedTimer.description, formatDuration(selectedTimer.progress)]);

            console.log(`${timersTable.toString()}\n`);
        }
    } catch (err) {
        console.log("\x1b[31m", "Please login or signup!\n");
    }
};

const start = async () => {
    console.log();

    const inputData = await inquirer.prompt(timerName);

    try {
        const sessionId = fs.readFileSync(sessionFileName, "utf-8");
        const res = await axios({
            method: "post",
            url: `${process.env.SERVER}/api/timers`,
            headers: {},
            params: {sessionId},
            data: inputData
        });

        console.log("\x1b[32m", `\nStarted timer "${res.data.description}", ID: ${res.data.id}\n`);
    } catch (err) {
        console.log("\x1b[31m", "Please login or signup!\n");
    }
};

const stop = async () => {
    console.log();

    if (!process.argv[3]) {
        console.log("\x1b[31m", "Please enter timer's ID!\n");
        return;
    }

    try {
        const sessionId = fs.readFileSync(sessionFileName, "utf-8");

        try {
            await axios({
                method: "post",
                url: `${process.env.SERVER}/api/timers/${process.argv[3]}/stop`,
                headers: {},
                params: {sessionId}
            });

            console.log("\x1b[32m", `Timer ID: ${process.argv[3]} stopped\n`);
        } catch (err) {
            console.log("\x1b[31m", "Please enter correct ID!\n");
        }
    } catch (err) {
        console.log("\x1b[31m", "Please login or signup!\n");
    }
};

(async () => {
    switch (process.argv[2]) {
        case "signup":
            await signupOrLogin(authForm);
            break;
        case "login":
            await signupOrLogin(authForm);
            break;
        case "logout":
            await logout();
            break;
        case "status":
            await status();
            break;
        case "start":
            await start();
            break;
        case "stop":
            await stop();
            break;
        default:
            console.log("\x1b[1m", "\nWelcome to the TimersApp!\n");
            break;
    }
})();

const formatDuration = (d) => {
    d = Math.floor(d / 1000);
    const s = d % 60;
    d = Math.floor(d / 60);
    const m = d % 60;
    const h = Math.floor(d / 60);
    return [h > 0 ? h : null, m, s]
        .filter((x) => x !== null)
        .map((x) => (x < 10 ? "0" : "") + x)
        .join(":");
};
