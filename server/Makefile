run:
	docker run -d -p 3000:3000 --rm --name timers-cli wihotka/timers-cli:env
build:
	docker build -t wihotka/timers-cli:env .
push:
	docker push wihotka/timers-cli:env
pull:
	docker pull wihotka/timers-cli:env