
function monitorAutopilotOscillation() {
    let lastVS = 0;
    let lastSign = 0;
    let lastFlipTime = 0;
    let flipCount = 0;

    const flipThreshold = 100;   // fpm change to count as a "swing"
    const flipWindow = 2000;     // ms between flips to call it oscillation
    const releaseMargin = 30;    // knots below critical speed to restore normal PIDs. Acts as a buffer if oscillations are detected while slowing down

    let dampened = false;
    let criticalSpeed = null;
    let originalValues = { pitchPID: null };

    let lastAircraftID = geofs?.aircraft?.instance?.aircraftRecord?.id || null;


    setInterval(() => {
        try {
            if (flight.recorder.playing) return;
            //console.log("running");
            const ap = geofs.autopilot;
            const VS = geofs.animation.values.verticalSpeed || 0;
            const speed = geofs.animation.values.kias || 0;
            const pitchPID = ap?.PIDs?.pitchAngle;
            if (!ap || !pitchPID) return;

            const apActive = ap.on;

            const delta = VS - lastVS;
            const magnitude = Math.abs(delta);
            const sign = Math.sign(delta);

            if (lastSign !== 0 && sign !== lastSign && magnitude > flipThreshold) {
                const now = Date.now();
                if (now - lastFlipTime < flipWindow) {
                    flipCount++;
                } else {
                    flipCount = 1;
                }
                lastFlipTime = now;
            }

            if (Date.now() - lastFlipTime > flipWindow * 2) flipCount = 0;
            //apply damping, save originals
            if (flipCount >= 2 && apActive && !dampened) {
            if (!originalValues.pitchPID) {
                originalValues.pitchPID = {
                    kp: pitchPID._kp,
                    ki: pitchPID._ki,
                    kd: pitchPID._kd
                };
            }

                criticalSpeed = speed;
                dampened = true;

                pitchPID._kp = 0.001;
                pitchPID._ki = 0.001;
                pitchPID._kd = 0.001;

                console.log(`oscillation detected at ${speed.toFixed(0)} kts, damping PIDs`);
            }

            // restore old pids when safe
            if (dampened && (!apActive || (criticalSpeed && speed < criticalSpeed - releaseMargin))) {
                const orig = originalValues.pitchPID;
                if (orig) {
                    pitchPID._kp = orig.kp;
                    pitchPID._ki = orig.ki;
                    pitchPID._kd = orig.kd;
                }

                dampened = false;
                criticalSpeed = null;
                flipCount = 0;
                console.log("restored normal PIDs.");
            }

            // save state
            lastVS = VS;
            lastSign = sign;
        } catch (e) {
            console.warn("Autopilot oscillation monitor error:", e);
        }

        //monitor aircraft changes
        let currentAircraftID = geofs?.aircraft?.instance?.aircraftRecord?.id || null;
        if (currentAircraftID !== lastAircraftID) {
            console.log("Aircraft changed, resetting pid record.");
            originalValues.pitchPID = null;
            dampened = false;
            flipCount = 0;
            criticalSpeed = null;
            lastAircraftID = currentAircraftID;
        }

    }, 100); 
}//end damping function
// setInterval(()=> {
//     console.log(geofs.autopilot.PIDs.pitchAngle._kp)
//     console.log(geofs.autopilot.PIDs.pitchAngle._ki)
//     console.log(geofs.autopilot.PIDs.pitchAngle._kd)
//     console.log("------------------------------------------------")

// }, 500);
monitorAutopilotOscillation();
