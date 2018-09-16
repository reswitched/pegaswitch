var time = 1499774400; //Unix time for July 11th, 2017, time needed for flog

sc.getService("time:s", (time_s)=>{
	/*
	Send message 1 (GetStandardNetworkSystemClock) which returns a handle to the system clock interface
	we get it from the response using .withHandles which will close the handle behind us when we are done

	see https://reswitched.github.io/SwIPC/ifaces.html#nn::timesrv::detail::service::IStaticService for more info
	*/
	sc.ipcMsg(1).sendTo(time_s).assertOk().withHandles((response, moved, copied) =>{
		sysClock = moved[0];
		/*
		Set time
		We send message 1 (SetCurrentTime) using the sysclock handle we just got, which sets the POSIX time
		which we pass in using .datau64 (which defines unsigned 64 bit paramters)

		see https://reswitched.github.io/SwIPC/ifaces.html#nn::timesrv::detail::service::ISystemClock for more info
		*/
		sc.ipcMsg(1).datau64(time).sendTo(sysClock).assertOk().data[0];
		/*
		Print new time
		we send message 0 (GetCurrentTime) using the sysclock handle we just got, which returns the POSIX time
		which we can grab from the response using .data[0] which we then log
		*/
		var currentTime = sc.ipcMsg(0).sendTo(sysClock).assertOk().data[0];
		utils.log("New time - "+currentTime);
	});
});
