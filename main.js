
function monitorAutopilotOscillation() {
    //define everything
    let lastVS = 0;
    let lastPitchSign = 0;
    let lastPitchFlipTime = 0;
    let pitchFlipCount = 0;

    let lastBankAngle = 0;
    let lastBankSign = 0
    let lastBankFlipTime = 0;
    let bankFlipCount = 0;

    const VSThreshold = 100;   // fpm change to count as a "swing"
    const pitchFlipWindow = 2000;     // ms between flips to call it oscillation

    const bankThreshold = 3; //degree change to qualify as bank swing
    const bankFlipWindow = 2000;

    const releaseMargin = 30;    // knots below critical speed to restore normal PIDs. Acts as a buffer if oscillations are detected while slowing down

    let pitchDamped = false;
    let pitchCriticalSpeed = null; // speed that oscillations were detected

    let bankDamped = false;
    let bankCriticalSpeed = null;

    let originalValues = { pitchPID: null, bankPID: null };

    let lastAircraftID = geofs?.aircraft?.instance?.aircraftRecord?.id || null;


    setInterval(() => {
        try {
            if (flight.recorder.playing) return;
            //console.log("running");
            const ap = geofs.autopilot;

            const VS = geofs.animation.values.verticalSpeed || 0;
            const bankAngle = geofs.animation.values.aroll || 0;
            const speed = geofs.animation.values.kias || 0;

            const pitchPID = ap?.PIDs?.pitchAngle;
            const bankPID = ap?.PIDs?.bankAngle;

            if (!ap || !pitchPID || !bankPID) return;

            const apActive = ap.on;

            const deltaPitch = VS - lastVS;
            const magnitudePitch = Math.abs(deltaPitch);
            const pitchSign = Math.sign(deltaPitch);
            
            const deltaBank = bankAngle - lastBankAngle;
            const magnitudeBank = Math.abs(deltaBank);
            const bankSign = Math.sign(deltaBank);

            if (lastPitchSign !== 0 && pitchSign !== lastPitchSign && magnitudePitch > VSThreshold) {
                const now = Date.now();
                if (now - lastPitchFlipTime < pitchFlipWindow) {
                    pitchFlipCount++;
                } else {
                    pitchFlipCount = 1;
                }
                lastPitchFlipTime = now;
            }

            if (lastBankSign !== 0 && bankSign !== lastBankSign && magnitudeBank > bankThreshold) {
                const now = Date.now();
                if (now - lastBankFlipTime < bankFlipWindow) {
                    bankFlipCount++;
                } else {
                    bankFlipCount = 1;
                }
                lastBankFlipTime = now;
            }

            if (Date.now() - lastPitchFlipTime > pitchFlipWindow * 2) pitchFlipCount = 0;
            if (Date.now() - lastBankFlipTime > bankFlipWindow * 2) bankFlipCount = 0;

            //apply damping, save originals
            if (pitchFlipCount >= 2 && apActive && !pitchDamped) {
            if (!originalValues.pitchPID) {
                originalValues.pitchPID = {
                    kp: pitchPID._kp,
                    ki: pitchPID._ki,
                    kd: pitchPID._kd
                };
            }

                pitchCriticalSpeed = speed;
                pitchDamped = true;

                pitchPID._kp = 0.001;
                pitchPID._ki = 0.001;
                pitchPID._kd = 0.001;

                console.log(`pitch oscillation detected at ${speed.toFixed(0)} kts, damping PIDs`);
            }

            if (bankFlipCount >= 2 && apActive && !bankDamped) {
            if (!originalValues.bankPID) {
                originalValues.bankPID = {
                    kp: bankPID._kp,
                    ki: bankPID._ki,
                    kd: bankPID._kd
                };
            }

                bankCriticalSpeed = speed;
                bankDamped = true;

                bankPID._kp = 0.1;

                console.log(`bank oscillation detected at ${speed.toFixed(0)} kts, damping PIDs`);
            }

            // restore old pids when safe
            if (pitchDamped && (!apActive || (pitchCriticalSpeed && speed < pitchCriticalSpeed - releaseMargin))) {
                const origPitch = originalValues.pitchPID;
                if (origPitch) {
                    pitchPID._kp = origPitch.kp;
                    pitchPID._ki = origPitch.ki;
                    pitchPID._kd = origPitch.kd;
                }

                pitchDamped = false;
                pitchCriticalSpeed = null;
                pitchFlipCount = 0;
                console.log("restored normal pitch PIDs.");
            }

            if (bankDamped && (!apActive || (bankCriticalSpeed && speed < bankCriticalSpeed - releaseMargin))) {
                const origBank = originalValues.bankPID;
                if (origBank) {
                    bankPID._kp = origBank.kp;
                    bankPID._ki = origBank.ki;
                    bankPID._kd = origBank.kd;
                }

                bankDamped = false;
                bankCriticalSpeed = null;
                bankFlipCount = 0;
                console.log("restored normal bank PIDs.");
            }

            // save state
            lastVS = VS;
            lastPitchSign = pitchSign;
            lastBankAngle = bankAngle;
            lastBankSign = bankSign;
        } catch (e) {
            console.warn("Autopilot oscillation monitor error:", e);
        } //end damping logic


        //monitor aircraft changes
        let currentAircraftID = geofs?.aircraft?.instance?.aircraftRecord?.id || null;
        if (currentAircraftID !== lastAircraftID) {
            console.log("Aircraft changed, resetting pid record.");
            originalValues.pitchPID = null;
            originalValues.bankPID = null;
            pitchDamped = false;
            bankDamped = false;
            pitchFlipCount = 0;
            bankFlipCount = 0;
            pitchCriticalSpeed = null;
            bankCriticalSpeed = null;
            lastAircraftID = currentAircraftID;
        }

    }, 100); 
}//end damping function
//log for debug
// setInterval(()=> {
//     console.log(geofs.autopilot.PIDs.pitchAngle._kp)
//     console.log(geofs.autopilot.PIDs.pitchAngle._ki)
//     console.log(geofs.autopilot.PIDs.pitchAngle._kd)
//     console.log(geofs.autopilot.PIDs.bankAngle._kp)
//     console.log("------------------------------------------------")

// }, 500);
monitorAutopilotOscillation();
