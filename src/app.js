"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const configs_json_1 = __importDefault(require("./configs.json"));
const moralis_1 = __importDefault(require("moralis"));
const evm_utils_1 = require("@moralisweb3/evm-utils");
const port = configs_json_1.default.serverPort;
const app = (0, express_1.default)();
app.use(express_1.default.json());
const corsOptions = {
    origin: ["http://localhost:11112"],
    methods: ["POST"],
    preflightContinue: true,
    allowedHeaders: ["Content-Type"],
};
app.post("/api", (request, response) => {
    /**
     * Call Moralis API to get the user's an NFT collection holding amount.
     * @param obj An verify info records token contract address and roles information.
     * @returns {Promise<VerifiedResult>} The user's NFT holding amount.
     */
    const callVerifiedAPI = async (obj) => {
        const chain = evm_utils_1.EvmChain.CRONOS;
        const address = request.body.walletAddress;
        const format = "decimal";
        const limit = 1;
        const tokenAddress = obj.tokenAddress;
        let result = {
            total: 0,
            roles: [],
        };
        try {
            await moralis_1.default.start(configs_json_1.default.moralis);
            const verifiedResponse = await moralis_1.default.EvmApi.account.getNFTsForContract({
                address,
                chain,
                tokenAddress,
                format,
                limit,
            });
            const userHoldingAmount = verifiedResponse.raw.total;
            console.log(`userHoldingNumber: ${userHoldingAmount}`); // for debug
            result.total = userHoldingAmount;
            result.roles = obj.roles;
        }
        catch (error) {
            console.log(error);
            result.total = -1;
            result.roles.length = 0;
        }
        finally {
            return result;
        }
    };
    /**
     * Record the roles available to the user.
     * @param record The user's NFT and the corresponding available roles.
     * @returns The names of the roles recorded.
     */
    const recordRoles = (record) => {
        let recordedRoles = [];
        record.roles.forEach((roleData) => {
            // for debug
            console.log(`record.total: ${record.total}`);
            console.log(`roleData.requiredAmount: ${roleData.requiredAmount}`);
            if (record.total >= roleData.requiredAmount) {
                recordedRoles.push(roleData);
            }
        });
        return recordedRoles;
    };
    /**
     * Execute the verify operation.
     * Note that if you add more than 25 contract addresses in configs.json,
     * you must split the promises into multiple groups before calling the Moralis API,
     * unless you are using the paid API.
     * @returns {Promise<Array<Role>>} The objects of the roles that the user will be assigned.
     */
    const process = async () => {
        let promises = [];
        const waitingCheckAddressInfo = configs_json_1.default.CheckingTokenAddresses;
        let verifiedResults = [];
        let recordedRoles = [];
        try {
            for (let i = 0; i < waitingCheckAddressInfo.length; i++) {
                promises.push(callVerifiedAPI(waitingCheckAddressInfo[i]));
            }
            verifiedResults = await Promise.all(promises);
            for (let i = 0; i < verifiedResults.length; i++) {
                recordedRoles = recordedRoles.concat(recordRoles(verifiedResults[i]));
            }
        }
        catch (error) {
            console.log(error);
            recordedRoles.length = 0;
        }
        finally {
            return recordedRoles;
        }
    };
    // Got a request from client.
    try {
        console.log(`Request from client IP Address: ${request.ip}`);
        (async () => {
            const recordedRoles = await process();
            if (recordedRoles.length > 0) {
                response.json({
                    status: "OK",
                    message: "You will get the below role(s) soon.",
                    roles: recordedRoles,
                });
            }
            else {
                response.json({
                    status: "Zero",
                    message: "You don't have the NFT(s) we set!",
                    roles: [],
                });
            }
        })();
    }
    catch (error) {
        console.log(error);
        response.json({
            status: "ERR",
            message: error.message,
            roles: [],
        });
    }
});
app.listen(port, () => {
    console.log(`server is running on http://localhost:${port}`);
});
