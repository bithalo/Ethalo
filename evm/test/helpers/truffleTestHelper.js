advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();
    const block = await web3.eth.getBlock('latest');
    return Promise.resolve(block);
}

advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result.result);
        });
    });
}

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(true)
        });
    });
}

module.exports = {
    advanceTime,
    advanceBlock,
    advanceTimeAndBlock
}
